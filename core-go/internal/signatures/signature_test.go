package signatures

import "testing"

func TestSignVerifyRoundTrip(t *testing.T) {
	for _, algo := range []string{"dilithium_2", "dilithium_3", "dilithium_5"} {
		t.Run(algo, func(t *testing.T) {
			scheme, err := New(algo)
			if err != nil {
				t.Fatalf("New(%s): %v", algo, err)
			}
			pub, priv, err := scheme.GenerateKeyPair()
			if err != nil {
				t.Fatalf("keygen: %v", err)
			}
			msg := []byte("policy-compliant access to patient_001")
			sig, err := scheme.Sign(priv, msg)
			if err != nil {
				t.Fatalf("sign: %v", err)
			}
			if !scheme.Verify(pub, msg, sig) {
				t.Fatal("valid signature failed to verify")
			}
		})
	}
}

func TestTamperedMessageFails(t *testing.T) {
	scheme, _ := New("dilithium_3")
	pub, priv, _ := scheme.GenerateKeyPair()
	sig, _ := scheme.Sign(priv, []byte("granted"))
	if scheme.Verify(pub, []byte("denied"), sig) {
		t.Fatal("signature must not verify against a different message")
	}
}

func TestTamperedSignatureFails(t *testing.T) {
	scheme, _ := New("dilithium_3")
	pub, priv, _ := scheme.GenerateKeyPair()
	msg := []byte("audit entry")
	sig, _ := scheme.Sign(priv, msg)
	sig[0] ^= 0xFF
	if scheme.Verify(pub, msg, sig) {
		t.Fatal("tampered signature must not verify")
	}
}
