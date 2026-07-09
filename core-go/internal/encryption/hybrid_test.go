package encryption

import (
	"bytes"
	"testing"

	"github.com/privyq/privyq/core-go/internal/kem"
)

func TestHybridRoundTrip(t *testing.T) {
	scheme, _ := kem.New("kyber_768")
	pub, priv, _ := scheme.GenerateKeyPair()
	plaintext := []byte("Patient: John D. (58). Echo: mild LV hypertrophy.")

	sealed, err := Encrypt(scheme, pub, plaintext)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if bytes.Contains(sealed.Ciphertext, []byte("Patient")) {
		t.Fatal("plaintext leaked into ciphertext")
	}
	out, err := Decrypt(scheme, priv, sealed)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if !bytes.Equal(out, plaintext) {
		t.Fatalf("round trip mismatch: %q", out)
	}
}

func TestTamperedCiphertextFails(t *testing.T) {
	scheme, _ := kem.New("kyber_768")
	pub, priv, _ := scheme.GenerateKeyPair()
	sealed, _ := Encrypt(scheme, pub, []byte("confidential"))
	sealed.Ciphertext[0] ^= 0xFF // flip a bit
	if _, err := Decrypt(scheme, priv, sealed); err == nil {
		t.Fatal("AES-GCM must reject a tampered ciphertext")
	}
}

func TestWrongKeyFails(t *testing.T) {
	scheme, _ := kem.New("kyber_768")
	pub, _, _ := scheme.GenerateKeyPair()
	_, wrongPriv, _ := scheme.GenerateKeyPair()
	sealed, _ := Encrypt(scheme, pub, []byte("secret"))
	if _, err := Decrypt(scheme, wrongPriv, sealed); err == nil {
		t.Fatal("decryption with the wrong key must fail")
	}
}
