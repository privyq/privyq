package encryption

import (
	"testing"

	"github.com/privyq/privyq/core-go/internal/kem"
)

func TestResourceHashIsStableAndHex(t *testing.T) {
	scheme, _ := kem.New("kyber_768")
	pub, _, _ := scheme.GenerateKeyPair()
	sealed, _ := Encrypt(scheme, pub, []byte("data"))
	h1 := sealed.ResourceHash()
	h2 := sealed.ResourceHash()
	if h1 != h2 {
		t.Fatal("resource hash must be deterministic")
	}
	if len(h1) != 64 {
		t.Fatalf("expected 64 hex chars for SHA-256, got %d", len(h1))
	}
}

func TestEncryptBadRecipientKey(t *testing.T) {
	scheme, _ := kem.New("kyber_768")
	if _, err := Encrypt(scheme, []byte("bad key"), []byte("data")); err == nil {
		t.Fatal("Encrypt with a malformed recipient key must error")
	}
}
