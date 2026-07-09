// Package signatures provides post-quantum digital signatures.
//
// Like package kem, the Scheme interface abstracts the provider (ARCH §25.2).
// The default backend is CRYSTALS-Dilithium (ML-DSA) from Cloudflare CIRCL.
// SPHINCS+ (now standardized as SLH-DSA) is also available. Falcon (FN-DSA) is
// not in the CIRCL build used here; it can be added via a liboqs backend that
// implements the same Scheme interface.
package signatures

import (
	"fmt"

	"github.com/cloudflare/circl/sign"
	"github.com/cloudflare/circl/sign/schemes"
)

// Scheme is a post-quantum signature scheme with opaque byte-slice keys.
type Scheme interface {
	Name() string
	GenerateKeyPair() (publicKey, privateKey []byte, err error)
	Sign(privateKey, message []byte) ([]byte, error)
	Verify(publicKey, message, signature []byte) bool
}

var algoMap = map[string]string{
	"dilithium_2":  "Dilithium2",
	"dilithium_3":  "Dilithium3",
	"dilithium_5":  "Dilithium5",
	"sphincs_128s": "SLH-DSA-SHA2-128s",
	"sphincs_192s": "SLH-DSA-SHA2-192s",
	"sphincs_256s": "SLH-DSA-SHA2-256s",
}

type circlScheme struct {
	name string
	sch  sign.Scheme
}

// New returns the signature Scheme for a PrivyQ algorithm id (e.g. "dilithium_3").
func New(algorithm string) (Scheme, error) {
	name, ok := algoMap[algorithm]
	if !ok {
		return nil, fmt.Errorf("signatures: unsupported algorithm %q", algorithm)
	}
	sch := schemes.ByName(name)
	if sch == nil {
		return nil, fmt.Errorf("signatures: circl has no scheme %q", name)
	}
	return &circlScheme{name: algorithm, sch: sch}, nil
}

// Supported reports whether the algorithm id is a known signature scheme.
func Supported(algorithm string) bool { _, ok := algoMap[algorithm]; return ok }

func (c *circlScheme) Name() string { return c.name }

func (c *circlScheme) GenerateKeyPair() ([]byte, []byte, error) {
	pk, sk, err := c.sch.GenerateKey()
	if err != nil {
		return nil, nil, fmt.Errorf("signatures: keygen: %w", err)
	}
	pkb, err := pk.MarshalBinary()
	if err != nil {
		return nil, nil, err
	}
	skb, err := sk.MarshalBinary()
	if err != nil {
		return nil, nil, err
	}
	return pkb, skb, nil
}

func (c *circlScheme) Sign(privateKey, message []byte) ([]byte, error) {
	sk, err := c.sch.UnmarshalBinaryPrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("signatures: bad private key: %w", err)
	}
	return c.sch.Sign(sk, message, nil), nil
}

func (c *circlScheme) Verify(publicKey, message, signature []byte) bool {
	pk, err := c.sch.UnmarshalBinaryPublicKey(publicKey)
	if err != nil {
		return false
	}
	return c.sch.Verify(pk, message, signature, nil)
}
