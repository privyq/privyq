// Package storage provides PostgreSQL-backed implementations of the core's
// KeyStorage and EvidenceStore interfaces (ARCH §12). It is wired in when
// DB_URL is set; otherwise the core uses the in-memory/local backends.
package storage

import (
	"context"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/privyq/privyq/core-go/internal/audit"
	"github.com/privyq/privyq/core-go/internal/keymanager"
	"github.com/privyq/privyq/core-go/pkg/types"
)

//go:embed schema.sql
var schemaSQL string

// Postgres bundles the pool and the two store implementations.
type Postgres struct {
	pool *pgxpool.Pool
}

// New opens a pool, applies the schema, and returns a Postgres handle.
func New(ctx context.Context, dsn string) (*Postgres, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("storage: connect: %w", err)
	}
	if _, err := pool.Exec(ctx, schemaSQL); err != nil {
		pool.Close()
		return nil, fmt.Errorf("storage: migrate: %w", err)
	}
	return &Postgres{pool: pool}, nil
}

// Close releases the pool.
func (p *Postgres) Close() { p.pool.Close() }

// Keys returns the KeyStorage view.
func (p *Postgres) Keys() keymanager.KeyStorage { return &pgKeyStore{p.pool} }

// Evidence returns the EvidenceStore view.
func (p *Postgres) Evidence() audit.EvidenceStore { return &pgEvidenceStore{p.pool} }

// Meta returns the auxiliary data-model store (users, policies, resources).
func (p *Postgres) Meta() *pgMeta { return &pgMeta{p.pool} }

type pgMeta struct{ pool *pgxpool.Pool }

func (m *pgMeta) UpsertUser(id, role, department, organization string) error {
	_, err := m.pool.Exec(context.Background(), `
		INSERT INTO users (id, username, role, department, organization)
		VALUES ($1,$1,$2,$3,$4)
		ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, department=EXCLUDED.department, organization=EXCLUDED.organization`,
		id, role, department, organization)
	return err
}

func (m *pgMeta) UpsertPolicy(policyHash string, policy types.Policy, createdBy string) error {
	body, err := json.Marshal(policy)
	if err != nil {
		return err
	}
	_, err = m.pool.Exec(context.Background(), `
		INSERT INTO policies (policy_hash, policy_json, created_by)
		VALUES ($1,$2,$3) ON CONFLICT (policy_hash) DO NOTHING`,
		policyHash, body, createdBy)
	return err
}

func (m *pgMeta) UpsertResource(resourceID, resourceHash, policyHash, owner string) error {
	_, err := m.pool.Exec(context.Background(), `
		INSERT INTO resources (id, resource_hash, policy_hash, owner)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (id) DO UPDATE SET resource_hash=EXCLUDED.resource_hash, policy_hash=EXCLUDED.policy_hash`,
		resourceID, resourceHash, policyHash, owner)
	return err
}

// ─────────────────────────── key store ───────────────────────────

type pgKeyStore struct{ pool *pgxpool.Pool }

func (s *pgKeyStore) Put(rec keymanager.Record) error {
	ctx := context.Background()
	meta, _ := json.Marshal(orEmpty(rec.Info.Metadata))
	_, err := s.pool.Exec(ctx, `
		INSERT INTO keys (id, version, algorithm, key_type, public_key, private_key, status,
		                  owner, organization, created_at, expires_at, metadata)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, metadata=EXCLUDED.metadata`,
		rec.Info.KeyID, rec.Info.Version, rec.Info.Algorithm, string(rec.Info.Type),
		rec.Info.PublicKey, rec.PrivateKey, string(rec.Info.Status), rec.Info.Owner,
		rec.Info.Organization, parseTime(rec.Info.CreatedAt), parseTimePtr(rec.Info.ExpiresAt), meta)
	return err
}

func (s *pgKeyStore) Get(keyID string) (keymanager.Record, error) {
	ctx := context.Background()
	var (
		rec              keymanager.Record
		kt, status       string
		created          time.Time
		expires          *time.Time
		rotated, revoked *time.Time
		meta             []byte
	)
	row := s.pool.QueryRow(ctx, `
		SELECT version, algorithm, key_type, public_key, private_key, status, owner, organization,
		       created_at, expires_at, rotated_at, revoked_at, metadata FROM keys WHERE id=$1`, keyID)
	err := row.Scan(&rec.Info.Version, &rec.Info.Algorithm, &kt, &rec.Info.PublicKey, &rec.PrivateKey,
		&status, &rec.Info.Owner, &rec.Info.Organization, &created, &expires, &rotated, &revoked, &meta)
	if errors.Is(err, pgx.ErrNoRows) {
		return keymanager.Record{}, keymanager.ErrKeyNotFound
	}
	if err != nil {
		return keymanager.Record{}, err
	}
	rec.Info.KeyID = keyID
	rec.Info.Type = types.KeyType(kt)
	rec.Info.Status = types.KeyStatus(status)
	rec.Info.CreatedAt = created.Format(time.RFC3339)
	rec.Info.ExpiresAt = fmtPtr(expires)
	rec.Info.RotatedAt = fmtPtr(rotated)
	rec.Info.RevokedAt = fmtPtr(revoked)
	_ = json.Unmarshal(meta, &rec.Info.Metadata)
	return rec, nil
}

func (s *pgKeyStore) List() ([]types.KeyInfo, error) {
	ctx := context.Background()
	rows, err := s.pool.Query(ctx, `SELECT id, algorithm, key_type, public_key, status, owner, organization FROM keys`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []types.KeyInfo
	for rows.Next() {
		var i types.KeyInfo
		var kt, status string
		if err := rows.Scan(&i.KeyID, &i.Algorithm, &kt, &i.PublicKey, &status, &i.Owner, &i.Organization); err != nil {
			return nil, err
		}
		i.Type, i.Status = types.KeyType(kt), types.KeyStatus(status)
		out = append(out, i)
	}
	return out, rows.Err()
}

func (s *pgKeyStore) Update(info types.KeyInfo) error {
	ctx := context.Background()
	meta, _ := json.Marshal(orEmpty(info.Metadata))
	ct, err := s.pool.Exec(ctx, `
		UPDATE keys SET status=$2, rotated_at=$3, revoked_at=$4, metadata=$5 WHERE id=$1`,
		info.KeyID, string(info.Status), parseTimePtr(info.RotatedAt), parseTimePtr(info.RevokedAt), meta)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return keymanager.ErrKeyNotFound
	}
	return nil
}

// ─────────────────────────── evidence store ───────────────────────────

type pgEvidenceStore struct{ pool *pgxpool.Pool }

func (s *pgEvidenceStore) Append(ev types.Evidence) (int64, error) {
	ctx := context.Background()
	body, err := json.Marshal(ev)
	if err != nil {
		return 0, err
	}
	entryHash, err := audit.EntryHash(ev)
	if err != nil {
		return 0, err
	}
	// The signed chain row and its denormalised audit_events index are written in
	// one transaction so they can never drift apart.
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `
		INSERT INTO evidence_log (position, evidence_id, timestamp, actor_id, resource_id, resource_hash,
		                          operation, result, signature, public_key_id, parent_hash, entry_hash, body)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		ev.Position, ev.EvidenceID, parseTime(ev.Timestamp), ev.Actor.UserID, ev.ResourceID, ev.ResourceHash,
		ev.Operation, ev.Result, ev.Signature, ev.PublicKeyID, ev.ParentHash, entryHash, body); err != nil {
		return 0, err
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO audit_events (resource_id, actor_id, action, status, evidence_id, timestamp)
		VALUES ($1,$2,$3,$4,$5,$6)`,
		ev.ResourceID, ev.Actor.UserID, ev.Operation, ev.Result, ev.EvidenceID, parseTime(ev.Timestamp)); err != nil {
		return 0, err
	}
	return ev.Position, tx.Commit(ctx)
}

func (s *pgEvidenceStore) LastHash() (string, error) {
	ctx := context.Background()
	var h string
	err := s.pool.QueryRow(ctx, `SELECT entry_hash FROM evidence_log ORDER BY position DESC LIMIT 1`).Scan(&h)
	if errors.Is(err, pgx.ErrNoRows) {
		return types.GenesisHash, nil
	}
	return h, err
}

func (s *pgEvidenceStore) Count() (int64, error) {
	ctx := context.Background()
	var n int64
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM evidence_log`).Scan(&n)
	return n, err
}

func (s *pgEvidenceStore) All() ([]types.Evidence, error) {
	return s.query("SELECT body FROM evidence_log ORDER BY position ASC", nil)
}

func (s *pgEvidenceStore) List(f audit.Filter) ([]types.Evidence, error) {
	q := "SELECT body FROM evidence_log WHERE 1=1"
	var args []any
	add := func(cond string, v any) { args = append(args, v); q += fmt.Sprintf(" AND %s$%d", cond, len(args)) }
	if f.ResourceID != "" {
		add("resource_id=", f.ResourceID)
	}
	if f.ActorID != "" {
		add("actor_id=", f.ActorID)
	}
	q += " ORDER BY position ASC"
	return s.query(q, args)
}

func (s *pgEvidenceStore) query(q string, args []any) ([]types.Evidence, error) {
	ctx := context.Background()
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []types.Evidence
	for rows.Next() {
		var body []byte
		if err := rows.Scan(&body); err != nil {
			return nil, err
		}
		var ev types.Evidence
		if err := json.Unmarshal(body, &ev); err != nil {
			return nil, err
		}
		out = append(out, ev)
	}
	return out, rows.Err()
}

// ─────────────────────────── helpers ───────────────────────────

func orEmpty(m map[string]string) map[string]string {
	if m == nil {
		return map[string]string{}
	}
	return m
}

func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Now().UTC()
	}
	return t
}

func parseTimePtr(s string) *time.Time {
	if s == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return nil
	}
	return &t
}

func fmtPtr(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format(time.RFC3339)
}

// base64 kept referenced for potential future binary columns.
var _ = base64.StdEncoding
