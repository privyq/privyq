package storage

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/privyq/privyq/core-go/internal/audit"
	"github.com/privyq/privyq/core-go/internal/core"
	"github.com/privyq/privyq/core-go/internal/keymanager"
	"github.com/privyq/privyq/core-go/pkg/types"
)

// Requires a reachable Postgres via PRIVYQ_TEST_DB. Skips otherwise so the unit
// suite stays hermetic (ARCH §23.2 integration tests use a real DB).
func testDSN(t *testing.T) string {
	dsn := os.Getenv("PRIVYQ_TEST_DB")
	if dsn == "" {
		t.Skip("set PRIVYQ_TEST_DB to run Postgres-backed tests")
	}
	return dsn
}

func TestPostgresPersistenceSurvivesRestart(t *testing.T) {
	dsn := testDSN(t)
	ctx := context.Background()

	// First "process": protect + access, producing keys and an evidence chain.
	pg1, err := New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	svc1 := core.New(keymanager.New(pg1.Keys()), pg1.Evidence(), "test")
	policy := types.Policy{Combination: "all", Conditions: []types.Condition{
		{Type: "role", Operator: "equals", Values: []string{"doctor"}},
	}}
	env, _, err := svc1.Protect([]byte("persisted record"), policy, "", "", "patient_p1", types.Identity{UserID: "dr", Role: "doctor"})
	if err != nil {
		t.Fatal(err)
	}
	raw := mustJSON(t, env)
	if _, _, err := svc1.Access(raw, types.Identity{Role: "doctor"}, types.Context{}); err != nil {
		t.Fatal(err)
	}
	countBefore, _ := pg1.Evidence().Count()
	pg1.Close()

	// Second "process": reopen the DB and confirm the chain survived and verifies.
	pg2, err := New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pg2.Close()
	svc2 := core.New(keymanager.New(pg2.Keys()), pg2.Evidence(), "test")
	entries, total, chainOK, err := svc2.EvidenceLog(audit.Filter{}, 1, 100)
	if err != nil {
		t.Fatal(err)
	}
	if int64(total) < countBefore || !chainOK {
		t.Fatalf("chain did not survive restart: total=%d before=%d ok=%v", total, countBefore, chainOK)
	}
	if len(entries) == 0 {
		t.Fatal("no entries after restart")
	}
}

// audit_events is written alongside the signed chain (v2, closes gap B4).
func TestAuditEventsPopulated(t *testing.T) {
	dsn := testDSN(t)
	ctx := context.Background()
	pg, err := New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pg.Close()

	svc := core.New(keymanager.New(pg.Keys()), pg.Evidence(), "test")
	policy := types.Policy{Combination: "all", Conditions: []types.Condition{
		{Type: "role", Operator: "equals", Values: []string{"doctor"}},
	}}
	env, _, err := svc.Protect([]byte("x"), policy, "", "", "res_ae", types.Identity{UserID: "dr", Role: "doctor"})
	if err != nil {
		t.Fatal(err)
	}
	raw := mustJSON(t, env)
	if _, _, err := svc.Access(raw, types.Identity{Role: "nurse"}, types.Context{}); err == nil {
		t.Fatal("nurse access should have been denied")
	}

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	var granted, denied int
	err = pool.QueryRow(ctx,
		`SELECT count(*) FILTER (WHERE status='granted'), count(*) FILTER (WHERE status='denied')
		 FROM audit_events WHERE resource_id=$1`, "res_ae").Scan(&granted, &denied)
	if err != nil {
		t.Fatal(err)
	}
	// protect (granted) + denied access → both statuses present, linked to evidence.
	if granted < 1 || denied < 1 {
		t.Fatalf("audit_events should record both outcomes, got granted=%d denied=%d", granted, denied)
	}
}

// users/policies/resources are written on protect (v2, closes gap B5).
func TestMetaTablesPopulated(t *testing.T) {
	dsn := testDSN(t)
	ctx := context.Background()
	pg, err := New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pg.Close()

	svc := core.New(keymanager.New(pg.Keys()), pg.Evidence(), "test")
	svc.Meta = pg.Meta()
	policy := types.Policy{Combination: "all", Conditions: []types.Condition{
		{Type: "role", Operator: "equals", Values: []string{"doctor"}},
	}}
	if _, _, err := svc.Protect([]byte("x"), policy, "", "", "res_meta1", types.Identity{UserID: "dr_meta", Role: "doctor", Department: "cardiology"}); err != nil {
		t.Fatal(err)
	}

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	var uRole, rid, phash string
	if err := pool.QueryRow(ctx, `SELECT role FROM users WHERE id=$1`, "dr_meta").Scan(&uRole); err != nil {
		t.Fatalf("user not persisted: %v", err)
	}
	if uRole != "doctor" {
		t.Fatalf("user role wrong: %q", uRole)
	}
	if err := pool.QueryRow(ctx, `SELECT id, policy_hash FROM resources WHERE id=$1`, "res_meta1").Scan(&rid, &phash); err != nil {
		t.Fatalf("resource not persisted: %v", err)
	}
	// The resource's policy_hash must reference a real policies row.
	var cnt int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM policies WHERE policy_hash=$1`, phash).Scan(&cnt); err != nil || cnt != 1 {
		t.Fatalf("policy not persisted / FK broken: cnt=%d err=%v", cnt, err)
	}
}

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return b
}
