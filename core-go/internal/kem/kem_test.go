package kem

import (
	"bytes"
	"testing"
)

func TestKyberRoundTrip(t *testing.T) {
	for _, algo := range []string{"kyber_512", "kyber_768", "kyber_1024"} {
		t.Run(algo, func(t *testing.T) {
			scheme, err := New(algo)
			if err != nil {
				t.Fatalf("New(%s): %v", algo, err)
			}
			pub, priv, err := scheme.GenerateKeyPair()
			if err != nil {
				t.Fatalf("keygen: %v", err)
			}
			ct, ss1, err := scheme.Encapsulate(pub)
			if err != nil {
				t.Fatalf("encapsulate: %v", err)
			}
			ss2, err := scheme.Decapsulate(priv, ct)
			if err != nil {
				t.Fatalf("decapsulate: %v", err)
			}
			if !bytes.Equal(ss1, ss2) {
				t.Fatal("shared secrets differ")
			}
		})
	}
}

func TestDecapsulateWrongKeyDiffers(t *testing.T) {
	scheme, _ := New("kyber_768")
	pub, _, _ := scheme.GenerateKeyPair()
	_, wrongPriv, _ := scheme.GenerateKeyPair()
	ct, ss1, _ := scheme.Encapsulate(pub)
	// Kyber decapsulation with the wrong key yields an (implicitly rejected)
	// but different shared secret — never the original.
	ss2, err := scheme.Decapsulate(wrongPriv, ct)
	if err != nil {
		return // acceptable: hard failure
	}
	if bytes.Equal(ss1, ss2) {
		t.Fatal("wrong key must not recover the shared secret")
	}
}

func TestUnsupportedAlgorithm(t *testing.T) {
	if _, err := New("rsa_2048"); err == nil {
		t.Fatal("expected error for unsupported algorithm")
	}
	if Supported("rsa_2048") {
		t.Fatal("rsa_2048 must not be supported")
	}
}
