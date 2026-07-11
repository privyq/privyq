package signatures

// The default, pure-Go signature backend: CRYSTALS-Dilithium (ML-DSA) and
// SPHINCS+ (SLH-DSA) from Cloudflare CIRCL. No CGO. Falcon (FN-DSA) is NOT in
// this backend — it is provided by the optional liboqs backend (see liboqs.go,
// built with `-tags liboqs`).

import (
	"fmt"

	"github.com/cloudflare/circl/sign"
	"github.com/cloudflare/circl/sign/schemes"
)

func init() { registerBackend("circl", circlBackend{}) }

// circlAlgoMap maps PrivyQ algorithm ids to CIRCL scheme names.
var circlAlgoMap = map[string]string{
	"dilithium_2":  "Dilithium2",
	"dilithium_3":  "Dilithium3",
	"dilithium_5":  "Dilithium5",
	"sphincs_128s": "SLH-DSA-SHA2-128s",
	"sphincs_192s": "SLH-DSA-SHA2-192s",
	"sphincs_256s": "SLH-DSA-SHA2-256s",
}

type circlBackend struct{}

func (circlBackend) Supported(algorithm string) bool { _, ok := circlAlgoMap[algorithm]; return ok }

func (circlBackend) New(algorithm string) (Scheme, error) {
	name, ok := circlAlgoMap[algorithm]
	if !ok {
		return nil, fmt.Errorf("signatures/circl: unsupported algorithm %q", algorithm)
	}
	sch := schemes.ByName(name)
	if sch == nil {
		return nil, fmt.Errorf("signatures/circl: no scheme %q", name)
	}
	return &circlScheme{name: algorithm, sch: sch}, nil
}

type circlScheme struct {
	name string
	sch  sign.Scheme
}

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
