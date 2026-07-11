// Package identity resolves and verifies requester identity attributes that feed
// the policy engine (v2 blueprint §10). Its headline feature is wallet/DID
// verification: a cryptographically-checked wallet challenge becomes a trusted
// subject attribute (e.g. wallet=...) that any policy can condition on — the
// identity half of the blockchain capability (§14).
//
// The default, dependency-free scheme is Ed25519 (Solana wallets and many DID
// methods). EVM/secp256k1 wallets plug in via an additional verifier without
// changing callers.
package identity

import (
	"crypto/ed25519"
	"encoding/hex"
	"fmt"
	"strings"
)

// VerifyWallet checks that signature over challenge was produced by the holder of
// publicKey under scheme, and returns a stable wallet address derived from the
// public key. The address is what policies condition on.
func VerifyWallet(scheme string, publicKey, challenge, signature []byte) (address string, err error) {
	switch strings.ToLower(strings.TrimSpace(scheme)) {
	case "", "ed25519":
		if len(publicKey) != ed25519.PublicKeySize {
			return "", fmt.Errorf("identity: ed25519 public key must be %d bytes, got %d", ed25519.PublicKeySize, len(publicKey))
		}
		if !ed25519.Verify(ed25519.PublicKey(publicKey), challenge, signature) {
			return "", fmt.Errorf("identity: wallet signature does not verify")
		}
		return "ed25519:" + hex.EncodeToString(publicKey), nil
	default:
		return "", fmt.Errorf("identity: unsupported wallet scheme %q (ed25519 built in; secp256k1/EVM via an adapter)", scheme)
	}
}
