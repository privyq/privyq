package signatures

import "testing"

// Covers the additional signature schemes reachable through the registry and
// the Supported / error branches.
func TestAlternativeSchemes(t *testing.T) {
	for _, algo := range []string{"sphincs_128s"} {
		t.Run(algo, func(t *testing.T) {
			if !Supported(algo) {
				t.Fatalf("%s should be supported", algo)
			}
			scheme, err := New(algo)
			if err != nil {
				t.Fatalf("New(%s): %v", algo, err)
			}
			pub, priv, err := scheme.GenerateKeyPair()
			if err != nil {
				t.Fatalf("keygen: %v", err)
			}
			msg := []byte("evidence")
			sig, err := scheme.Sign(priv, msg)
			if err != nil {
				t.Fatalf("sign: %v", err)
			}
			if !scheme.Verify(pub, msg, sig) {
				t.Fatal("valid signature failed to verify")
			}
			if scheme.Name() != algo {
				t.Fatalf("Name() = %q", scheme.Name())
			}
		})
	}
}

func TestSignWithBadPrivateKey(t *testing.T) {
	scheme, _ := New("dilithium_3")
	if _, err := scheme.Sign([]byte("not a key"), []byte("m")); err == nil {
		t.Fatal("signing with a malformed private key must error")
	}
}

func TestVerifyWithBadPublicKey(t *testing.T) {
	scheme, _ := New("dilithium_3")
	if scheme.Verify([]byte("not a key"), []byte("m"), []byte("sig")) {
		t.Fatal("verify with a malformed public key must return false")
	}
}

func TestUnsupportedSignatureAlgorithm(t *testing.T) {
	if _, err := New("rsa_pss"); err == nil {
		t.Fatal("expected error for unsupported signature algorithm")
	}
	if Supported("rsa_pss") {
		t.Fatal("rsa_pss must not be supported")
	}
}
