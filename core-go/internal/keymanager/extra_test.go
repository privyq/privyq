package keymanager

import (
	"path/filepath"
	"testing"

	"github.com/privyq/privyq/core-go/pkg/types"
)

func TestInfoAndListAndNotFound(t *testing.T) {
	m := New(NewMemoryStore())
	a, _ := m.Generate("kyber_768", types.KeyEncryption, "org", "o1", nil)
	_, _ = m.Generate("dilithium_3", types.KeySigning, "org", "o2", nil)

	info, err := m.Info(a.KeyID)
	if err != nil || info.KeyID != a.KeyID {
		t.Fatalf("Info failed: %v", err)
	}
	list, err := m.List()
	if err != nil || len(list) != 2 {
		t.Fatalf("List should return 2, got %d (%v)", len(list), err)
	}
	if _, err := m.Info("missing"); err != ErrKeyNotFound {
		t.Fatalf("expected ErrKeyNotFound, got %v", err)
	}
	if _, _, err := m.PublicKey("missing"); err != ErrKeyNotFound {
		t.Fatalf("expected ErrKeyNotFound for PublicKey, got %v", err)
	}
}

func TestLocalFileStoreListAndUpdate(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "keys")
	store, err := NewLocalFileStore(dir, "pw")
	if err != nil {
		t.Fatal(err)
	}
	m := New(store)
	a, _ := m.Generate("kyber_768", types.KeyEncryption, "org", "o1", map[string]string{"department": "cardiology"})
	_, _ = m.Generate("dilithium_3", types.KeySigning, "org", "o2", nil)

	infos, err := store.List()
	if err != nil || len(infos) != 2 {
		t.Fatalf("file store List should return 2, got %d (%v)", len(infos), err)
	}
	// Update via rotate (marks rotated + writes).
	if _, _, err := m.Rotate(a.KeyID, "24h"); err != nil {
		t.Fatal(err)
	}
	updated, _ := store.Get(a.KeyID)
	if updated.Info.Status != types.StatusRotated {
		t.Fatalf("expected rotated status, got %s", updated.Info.Status)
	}
	// Ensure signing key finds the existing one on a file store.
	sk, err := m.EnsureSigningKey()
	if err != nil || sk.Type != types.KeySigning {
		t.Fatalf("EnsureSigningKey failed: %v", err)
	}
}

func TestLocalFileStoreMissingKey(t *testing.T) {
	store, _ := NewLocalFileStore(filepath.Join(t.TempDir(), "k"), "pw")
	if _, err := store.Get("nope"); err != ErrKeyNotFound {
		t.Fatalf("expected ErrKeyNotFound, got %v", err)
	}
	if err := store.Update(types.KeyInfo{KeyID: "nope"}); err == nil {
		t.Fatal("updating a missing key should error")
	}
}

func TestGenerateUnknownTypeFails(t *testing.T) {
	m := New(NewMemoryStore())
	if _, err := m.Generate("kyber_768", types.KeyType("weird"), "", "", nil); err == nil {
		t.Fatal("unknown key type must error")
	}
}
