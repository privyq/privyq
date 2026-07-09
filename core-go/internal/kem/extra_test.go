package kem

import "testing"

func TestSupportedAndSharedSecretSize(t *testing.T) {
	if !Supported("kyber_768") {
		t.Fatal("kyber_768 should be supported")
	}
	scheme, _ := New("kyber_768")
	if scheme.SharedSecretSize() != 32 {
		t.Fatalf("kyber_768 shared secret size = %d, want 32", scheme.SharedSecretSize())
	}
	if scheme.Name() != "kyber_768" {
		t.Fatalf("Name() = %q", scheme.Name())
	}
}

func TestEncapsulateBadPublicKey(t *testing.T) {
	scheme, _ := New("kyber_768")
	if _, _, err := scheme.Encapsulate([]byte("too short")); err == nil {
		t.Fatal("encapsulate with a malformed public key must error")
	}
}

func TestDecapsulateBadPrivateKey(t *testing.T) {
	scheme, _ := New("kyber_768")
	if _, err := scheme.Decapsulate([]byte("too short"), []byte("ct")); err == nil {
		t.Fatal("decapsulate with a malformed private key must error")
	}
}
