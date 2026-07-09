package keymanager

import (
	"path/filepath"
	"testing"

	"github.com/privyq/privyq/core-go/pkg/types"
)

func TestGenerateAndRetrieve(t *testing.T) {
	m := New(NewMemoryStore())
	info, err := m.Generate("kyber_768", types.KeyEncryption, "Hospital A", "dr_smith", nil)
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != types.StatusActive || info.Type != types.KeyEncryption {
		t.Fatalf("unexpected key info: %+v", info)
	}
	pub, algo, err := m.PublicKey(info.KeyID)
	if err != nil || len(pub) == 0 || algo != "kyber_768" {
		t.Fatalf("public key retrieval failed: %v", err)
	}
	priv, _, err := m.PrivateKey(info.KeyID)
	if err != nil || len(priv) == 0 {
		t.Fatalf("private key retrieval failed: %v", err)
	}
}

func TestRotateAndRevoke(t *testing.T) {
	m := New(NewMemoryStore())
	info, _ := m.Generate("kyber_768", types.KeyEncryption, "org", "owner", nil)

	oldInfo, newInfo, err := m.Rotate(info.KeyID, "24h")
	if err != nil {
		t.Fatal(err)
	}
	if oldInfo.Status != types.StatusRotated || newInfo.KeyID == info.KeyID {
		t.Fatal("rotation did not produce a new active key / mark old rotated")
	}
	// Old key still retrievable for decrypting historical data.
	if _, _, err := m.PrivateKey(info.KeyID); err != nil {
		t.Fatalf("rotated key must remain usable for old data: %v", err)
	}

	revoked, err := m.Revoke(newInfo.KeyID, "compromise")
	if err != nil {
		t.Fatal(err)
	}
	if revoked.Status != types.StatusRevoked {
		t.Fatal("key not marked revoked")
	}
	if _, _, err := m.PrivateKey(newInfo.KeyID); err == nil {
		t.Fatal("revoked key must not yield a private key")
	}
}

func TestEnsureSigningKeyIsStable(t *testing.T) {
	m := New(NewMemoryStore())
	a, err := m.EnsureSigningKey()
	if err != nil {
		t.Fatal(err)
	}
	b, _ := m.EnsureSigningKey()
	if a.KeyID != b.KeyID {
		t.Fatal("EnsureSigningKey should reuse the existing active signing key")
	}
	if a.Type != types.KeySigning {
		t.Fatal("signing key must have signing type")
	}
}

func TestLocalFileStorePersists(t *testing.T) {
	dir := t.TempDir()
	store, err := NewLocalFileStore(filepath.Join(dir, "keys"), "master-pw")
	if err != nil {
		t.Fatal(err)
	}
	m := New(store)
	info, err := m.Generate("dilithium_3", types.KeySigning, "org", "owner", nil)
	if err != nil {
		t.Fatal(err)
	}
	// Re-open the store from disk and confirm the key survives (encrypted at rest).
	store2, _ := NewLocalFileStore(filepath.Join(dir, "keys"), "master-pw")
	rec, err := store2.Get(info.KeyID)
	if err != nil {
		t.Fatalf("key did not persist: %v", err)
	}
	if len(rec.PrivateKey) == 0 || rec.Info.KeyID != info.KeyID {
		t.Fatal("persisted record incomplete")
	}
}

func TestHierarchyRegistration(t *testing.T) {
	m := New(NewMemoryStore())
	info, _ := m.Generate("kyber_768", types.KeyEncryption, "Hospital A", "dr_smith", map[string]string{"department": "cardiology"})
	ids := m.Hierarchy().KeysFor("Hospital A", "cardiology", "dr_smith")
	if len(ids) != 1 || ids[0] != info.KeyID {
		t.Fatalf("hierarchy lookup failed: %v", ids)
	}
}
