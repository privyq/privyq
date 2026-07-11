package keymanager

import (
	"bytes"
	"testing"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// xorWrapper is a deterministic test KeyWrapper: it proves the envelope store
// round-trips through a wrapper without needing an external HSM/KMS. (Real
// backends replace this with an HSM/KMS-backed wrap.)
type xorWrapper struct{}

func (xorWrapper) Name() string { return "test-xor" }
func (xorWrapper) Wrap(dek []byte) ([]byte, error) {
	out := make([]byte, len(dek))
	for i, b := range dek {
		out[i] = b ^ 0x5A
	}
	return out, nil
}
func (xorWrapper) Unwrap(w []byte) ([]byte, error) { return xorWrapper{}.Wrap(w) } // XOR is its own inverse

func TestEnvelopeFileStoreRoundTrip(t *testing.T) {
	store, err := NewEnvelopeFileStore(t.TempDir(), xorWrapper{})
	if err != nil {
		t.Fatal(err)
	}
	rec := Record{
		Info:       types.KeyInfo{KeyID: "k1", Algorithm: "dilithium_3", Type: types.KeySigning, Status: types.StatusActive},
		PrivateKey: bytes.Repeat([]byte{0xAB}, 4096), // large key material, like a Dilithium/SPHINCS secret
	}
	if err := store.Put(rec); err != nil {
		t.Fatal(err)
	}
	got, err := store.Get("k1")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got.PrivateKey, rec.PrivateKey) {
		t.Fatal("private key did not round-trip through the envelope store")
	}
	if got.Info.Algorithm != "dilithium_3" {
		t.Fatalf("info not preserved: %+v", got.Info)
	}

	// Update + List.
	rec.Info.Status = types.StatusRevoked
	if err := store.Update(rec.Info); err != nil {
		t.Fatal(err)
	}
	list, err := store.List()
	if err != nil || len(list) != 1 || list[0].Status != types.StatusRevoked {
		t.Fatalf("list/update failed: %v %+v", err, list)
	}

	// Missing key.
	if _, err := store.Get("nope"); err != ErrKeyNotFound {
		t.Fatalf("expected ErrKeyNotFound, got %v", err)
	}

	// nil wrapper rejected.
	if _, err := NewEnvelopeFileStore(t.TempDir(), nil); err == nil {
		t.Fatal("nil wrapper should be rejected")
	}
}
