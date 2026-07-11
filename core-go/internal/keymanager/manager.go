package keymanager

import (
	"encoding/base64"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/privyq/privyq/core-go/internal/kem"
	"github.com/privyq/privyq/core-go/internal/signatures"
	"github.com/privyq/privyq/core-go/pkg/types"
)

// Manager implements the key lifecycle over a KeyStorage backend (ARCH §13.2).
type Manager struct {
	store     KeyStorage
	hierarchy *Hierarchy
}

// New returns a Manager backed by store.
func New(store KeyStorage) *Manager {
	return &Manager{store: store, hierarchy: NewHierarchy()}
}

// Hierarchy exposes the org→dept→user key graph.
func (m *Manager) Hierarchy() *Hierarchy { return m.hierarchy }

// Generate creates a new key pair of the given type/algorithm, stores it, and
// returns its public metadata. Encryption keys use a KEM; signing keys use a
// signature scheme.
func (m *Manager) Generate(algorithm string, keyType types.KeyType, org, owner string, meta map[string]string) (types.KeyInfo, error) {
	if algorithm == "" {
		if keyType == types.KeySigning {
			algorithm = types.DefaultSignature
		} else {
			algorithm = types.DefaultKEM
		}
	}
	var pub, priv []byte
	var err error
	switch keyType {
	case types.KeyEncryption:
		var scheme kem.Scheme
		if scheme, err = kem.New(algorithm); err == nil {
			pub, priv, err = scheme.GenerateKeyPair()
		}
	case types.KeySigning:
		var scheme signatures.Scheme
		if scheme, err = signatures.New(algorithm); err == nil {
			pub, priv, err = scheme.GenerateKeyPair()
		}
	default:
		return types.KeyInfo{}, fmt.Errorf("keymanager: unknown key type %q", keyType)
	}
	if err != nil {
		return types.KeyInfo{}, err
	}

	now := time.Now().UTC()
	info := types.KeyInfo{
		KeyID:        uuid.NewString(),
		Version:      "1.0",
		Algorithm:    algorithm,
		Type:         keyType,
		PublicKey:    base64.StdEncoding.EncodeToString(pub),
		Status:       types.StatusActive,
		CreatedAt:    now.Format(time.RFC3339),
		ExpiresAt:    now.AddDate(1, 0, 0).Format(time.RFC3339),
		Organization: org,
		Owner:        owner,
		Metadata:     meta,
	}
	if err := m.store.Put(Record{Info: info, PrivateKey: priv}); err != nil {
		return types.KeyInfo{}, err
	}
	m.hierarchy.Register(info)
	return info, nil
}

// PublicKey returns the raw public key bytes and algorithm for a key id.
func (m *Manager) PublicKey(keyID string) ([]byte, string, error) {
	rec, err := m.store.Get(keyID)
	if err != nil {
		return nil, "", err
	}
	pub, err := base64.StdEncoding.DecodeString(rec.Info.PublicKey)
	if err != nil {
		return nil, "", err
	}
	return pub, rec.Info.Algorithm, nil
}

// PrivateKey returns the raw private key bytes for a key id. Callers must be
// inside the trusted core; private keys never leave this process.
func (m *Manager) PrivateKey(keyID string) ([]byte, string, error) {
	rec, err := m.store.Get(keyID)
	if err != nil {
		return nil, "", err
	}
	if rec.Info.Status == types.StatusRevoked {
		return nil, "", fmt.Errorf("keymanager: key %s is revoked", keyID)
	}
	return rec.PrivateKey, rec.Info.Algorithm, nil
}

// Info returns the public metadata for a key.
func (m *Manager) Info(keyID string) (types.KeyInfo, error) {
	rec, err := m.store.Get(keyID)
	if err != nil {
		return types.KeyInfo{}, err
	}
	return rec.Info, nil
}

// Rotate marks the old key rotated and generates a replacement of the same
// type/algorithm. The old key is retained so previously protected data can
// still be decrypted (ARCH §13.2).
func (m *Manager) Rotate(keyID, gracePeriod string) (types.KeyInfo, types.KeyInfo, error) {
	old, err := m.store.Get(keyID)
	if err != nil {
		return types.KeyInfo{}, types.KeyInfo{}, err
	}
	old.Info.Status = types.StatusRotated
	old.Info.RotatedAt = time.Now().UTC().Format(time.RFC3339)
	if err := m.store.Update(old.Info); err != nil {
		return types.KeyInfo{}, types.KeyInfo{}, err
	}
	newInfo, err := m.Generate(old.Info.Algorithm, old.Info.Type, old.Info.Organization, old.Info.Owner, old.Info.Metadata)
	if err != nil {
		return types.KeyInfo{}, types.KeyInfo{}, err
	}
	return old.Info, newInfo, nil
}

// Revoke permanently disables a key.
func (m *Manager) Revoke(keyID, reason string) (types.KeyInfo, error) {
	rec, err := m.store.Get(keyID)
	if err != nil {
		return types.KeyInfo{}, err
	}
	rec.Info.Status = types.StatusRevoked
	rec.Info.RevokedAt = time.Now().UTC().Format(time.RFC3339)
	if rec.Info.Metadata == nil {
		rec.Info.Metadata = map[string]string{}
	}
	if reason != "" {
		rec.Info.Metadata["revocation_reason"] = reason
	}
	if err := m.store.Update(rec.Info); err != nil {
		return types.KeyInfo{}, err
	}
	return rec.Info, nil
}

// Expire transitions a key to the Expired lifecycle state (used by retention
// sweeps when a key passes its ExpiresAt). Idempotent.
func (m *Manager) Expire(keyID string) (types.KeyInfo, error) {
	rec, err := m.store.Get(keyID)
	if err != nil {
		return types.KeyInfo{}, err
	}
	rec.Info.Status = types.StatusExpired
	if err := m.store.Update(rec.Info); err != nil {
		return types.KeyInfo{}, err
	}
	return rec.Info, nil
}

// EnsureSigningKey returns an existing active signing key or generates one.
// The core uses this to sign audit evidence when the caller supplies none.
func (m *Manager) EnsureSigningKey() (types.KeyInfo, error) {
	infos, err := m.store.List()
	if err != nil {
		return types.KeyInfo{}, err
	}
	for _, i := range infos {
		if i.Type == types.KeySigning && i.Status == types.StatusActive {
			return i, nil
		}
	}
	return m.Generate(types.DefaultSignature, types.KeySigning, "system", "privyq-core", map[string]string{"role": "audit-signer"})
}

// List returns public metadata for all keys.
func (m *Manager) List() ([]types.KeyInfo, error) { return m.store.List() }
