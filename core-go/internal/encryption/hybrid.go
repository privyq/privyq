// Package encryption implements PrivyQ's hybrid encryption scheme (BP §8.3):
// a post-quantum KEM (Kyber) encapsulates a fresh symmetric key, and the data
// itself is sealed with AES-256-GCM. This gives post-quantum confidentiality
// with the speed of symmetric encryption for the payload.
package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"

	"github.com/privyq/privyq/core-go/internal/kem"
	"golang.org/x/crypto/hkdf"
)

// hkdfInfo domain-separates the KEM shared secret when deriving the AES key.
var hkdfInfo = []byte("privyq/hybrid/aes-256-gcm/v1")

// Sealed is the output of Encrypt: everything needed to decrypt given the KEM
// private key. Byte fields are raw; the caller base64-encodes for transport.
type Sealed struct {
	EncapsulatedKey []byte // KEM ciphertext
	Nonce           []byte // GCM nonce
	Ciphertext      []byte // AES-256-GCM ciphertext + tag
}

// ResourceHash returns the hex SHA-256 of the ciphertext, used as the resource
// identifier in audit evidence (ARCH §15.1).
func (s Sealed) ResourceHash() string {
	sum := sha256.Sum256(s.Ciphertext)
	return hex.EncodeToString(sum[:])
}

// Encrypt encapsulates a symmetric key to recipientPublicKey via the KEM, then
// seals plaintext with AES-256-GCM.
func Encrypt(scheme kem.Scheme, recipientPublicKey, plaintext []byte) (*Sealed, error) {
	encapsulated, sharedSecret, err := scheme.Encapsulate(recipientPublicKey)
	if err != nil {
		return nil, err
	}
	aesKey, err := deriveKey(sharedSecret)
	if err != nil {
		return nil, err
	}
	gcm, err := newGCM(aesKey)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("encryption: nonce: %w", err)
	}
	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)
	return &Sealed{EncapsulatedKey: encapsulated, Nonce: nonce, Ciphertext: ciphertext}, nil
}

// Decrypt recovers the symmetric key via the KEM private key and opens the
// AES-256-GCM ciphertext. A tampered ciphertext, nonce, or key fails here.
func Decrypt(scheme kem.Scheme, recipientPrivateKey []byte, sealed *Sealed) ([]byte, error) {
	sharedSecret, err := scheme.Decapsulate(recipientPrivateKey, sealed.EncapsulatedKey)
	if err != nil {
		return nil, err
	}
	aesKey, err := deriveKey(sharedSecret)
	if err != nil {
		return nil, err
	}
	gcm, err := newGCM(aesKey)
	if err != nil {
		return nil, err
	}
	plaintext, err := gcm.Open(nil, sealed.Nonce, sealed.Ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("encryption: authentication failed (tampered or wrong key): %w", err)
	}
	return plaintext, nil
}

// deriveKey turns a KEM shared secret into a 32-byte AES-256 key via HKDF-SHA256.
func deriveKey(sharedSecret []byte) ([]byte, error) {
	r := hkdf.New(sha256.New, sharedSecret, nil, hkdfInfo)
	key := make([]byte, 32)
	if _, err := io.ReadFull(r, key); err != nil {
		return nil, fmt.Errorf("encryption: hkdf: %w", err)
	}
	return key, nil
}

func newGCM(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("encryption: aes: %w", err)
	}
	return cipher.NewGCM(block)
}
