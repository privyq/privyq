package identity

import (
	"crypto/ed25519"
	"crypto/rand"
	"testing"
)

func TestVerifyWalletEd25519(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	challenge := []byte("privyq-login-nonce-abc123")
	sig := ed25519.Sign(priv, challenge)

	addr, err := VerifyWallet("ed25519", pub, challenge, sig)
	if err != nil {
		t.Fatalf("valid signature should verify: %v", err)
	}
	if addr == "" || addr[:8] != "ed25519:" {
		t.Fatalf("unexpected address %q", addr)
	}
	// Same key + challenge is deterministic -> stable address.
	if addr2, _ := VerifyWallet("", pub, challenge, sig); addr2 != addr {
		t.Fatal("address should be stable for the same key")
	}

	// Tampered challenge must not verify.
	if _, err := VerifyWallet("ed25519", pub, []byte("different-nonce"), sig); err == nil {
		t.Fatal("tampered challenge must fail")
	}
	// Wrong key size.
	if _, err := VerifyWallet("ed25519", []byte("short"), challenge, sig); err == nil {
		t.Fatal("bad key size must fail")
	}
	// Unsupported scheme.
	if _, err := VerifyWallet("secp256k1", pub, challenge, sig); err == nil {
		t.Fatal("unsupported scheme must fail")
	}
}
