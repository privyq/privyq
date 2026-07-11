package kem

// The default, pure-Go KEM backend: CRYSTALS-Kyber (ML-KEM) from Cloudflare
// CIRCL. No CGO. The optional liboqs backend (liboqs.go, `-tags liboqs`) provides
// the same algorithms via the Open Quantum Safe library.

import (
	"fmt"

	"github.com/cloudflare/circl/kem"
	"github.com/cloudflare/circl/kem/schemes"
)

func init() { registerBackend("circl", circlBackend{}) }

// circlAlgoMap maps PrivyQ algorithm identifiers to CIRCL scheme names.
var circlAlgoMap = map[string]string{
	"kyber_512":  "Kyber512",
	"kyber_768":  "Kyber768",
	"kyber_1024": "Kyber1024",
}

type circlBackend struct{}

func (circlBackend) Supported(algorithm string) bool { _, ok := circlAlgoMap[algorithm]; return ok }

func (circlBackend) New(algorithm string) (Scheme, error) {
	name, ok := circlAlgoMap[algorithm]
	if !ok {
		return nil, fmt.Errorf("kem/circl: unsupported algorithm %q", algorithm)
	}
	sch := schemes.ByName(name)
	if sch == nil {
		return nil, fmt.Errorf("kem/circl: no scheme %q", name)
	}
	return &circlScheme{name: algorithm, sch: sch}, nil
}

// circlScheme adapts a circl kem.Scheme to our Scheme interface.
type circlScheme struct {
	name string
	sch  kem.Scheme
}

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
