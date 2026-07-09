// Package kem provides post-quantum Key Encapsulation Mechanisms.
//
// The Scheme interface abstracts the concrete PQC provider so the backend can
// be swapped (ARCH §25.2). The default backend is CRYSTALS-Kyber (ML-KEM) from
// Cloudflare CIRCL — a pure-Go, NIST-standardized implementation that builds
// without CGO. A liboqs/CGO backend can implement the same interface later
// without touching callers (see the project docs).
package kem

import (
	"fmt"

	"github.com/cloudflare/circl/kem"
	"github.com/cloudflare/circl/kem/schemes"
)

// Scheme is a post-quantum KEM. Keys are handled as opaque byte slices so the
// rest of the core never depends on a concrete crypto library's types.
type Scheme interface {
	Name() string
	GenerateKeyPair() (publicKey, privateKey []byte, err error)
	// Encapsulate produces a ciphertext and the shared secret for the holder of publicKey.
	Encapsulate(publicKey []byte) (ciphertext, sharedSecret []byte, err error)
	// Decapsulate recovers the shared secret from ciphertext using privateKey.
	Decapsulate(privateKey, ciphertext []byte) (sharedSecret []byte, err error)
	SharedSecretSize() int
}

// algoMap maps PrivyQ algorithm identifiers to CIRCL scheme names.
var algoMap = map[string]string{
	"kyber_512":  "Kyber512",
	"kyber_768":  "Kyber768",
	"kyber_1024": "Kyber1024",
}

// circlScheme adapts a circl kem.Scheme to our Scheme interface.
type circlScheme struct {
	name string
	sch  kem.Scheme
}

// New returns the KEM Scheme for a PrivyQ algorithm id (e.g. "kyber_768").
func New(algorithm string) (Scheme, error) {
	name, ok := algoMap[algorithm]
	if !ok {
		return nil, fmt.Errorf("kem: unsupported algorithm %q", algorithm)
	}
	sch := schemes.ByName(name)
	if sch == nil {
		return nil, fmt.Errorf("kem: circl has no scheme %q", name)
	}
	return &circlScheme{name: algorithm, sch: sch}, nil
}

// Supported reports whether the algorithm id is a known KEM.
func Supported(algorithm string) bool { _, ok := algoMap[algorithm]; return ok }

func (c *circlScheme) Name() string { return c.name }

func (c *circlScheme) GenerateKeyPair() ([]byte, []byte, error) {
	pk, sk, err := c.sch.GenerateKeyPair()
	if err != nil {
		return nil, nil, fmt.Errorf("kem: keygen: %w", err)
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

func (c *circlScheme) Encapsulate(publicKey []byte) ([]byte, []byte, error) {
	pk, err := c.sch.UnmarshalBinaryPublicKey(publicKey)
	if err != nil {
		return nil, nil, fmt.Errorf("kem: bad public key: %w", err)
	}
	ct, ss, err := c.sch.Encapsulate(pk)
	if err != nil {
		return nil, nil, fmt.Errorf("kem: encapsulate: %w", err)
	}
	return ct, ss, nil
}

func (c *circlScheme) Decapsulate(privateKey, ciphertext []byte) ([]byte, error) {
	sk, err := c.sch.UnmarshalBinaryPrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("kem: bad private key: %w", err)
	}
	ss, err := c.sch.Decapsulate(sk, ciphertext)
	if err != nil {
		return nil, fmt.Errorf("kem: decapsulate: %w", err)
	}
	return ss, nil
}

func (c *circlScheme) SharedSecretSize() int { return c.sch.SharedKeySize() }
