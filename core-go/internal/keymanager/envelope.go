package keymanager

// Envelope-encryption key storage: the shared machinery behind the HSM and
// cloud-KMS backends (v2 blueprint §11). Each key Record is sealed under a fresh
// random 256-bit data-encryption key (DEK) with AES-256-GCM; the DEK is then
// *wrapped* by an external KeyWrapper (an HSM or a cloud KMS). The wrapping key
// never leaves the HSM/KMS, and the DEK never touches disk in the clear.

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// KeyWrapper wraps and unwraps a small data-encryption key. HSM and cloud-KMS
// backends implement it; the implementation delegates to the external system so
// the master/wrapping key is never exposed to PrivyQ.
type KeyWrapper interface {
	Wrap(dek []byte) (wrapped []byte, err error)
	Unwrap(wrapped []byte) (dek []byte, err error)
	Name() string
}

type envelopeRecord struct {
	Wrapper    string `json:"wrapper"`
	WrappedDEK []byte `json:"wrapped_dek"`
	Sealed     []byte `json:"sealed"` // AES-256-GCM(nonce||ciphertext) of the Record JSON under the DEK
}

type envelopeFileStore struct {
	mu      sync.RWMutex
	dir     string
	wrapper KeyWrapper
}

// NewEnvelopeFileStore returns a KeyStorage that seals each key under a wrapped
// DEK and persists it to dir. Used by the HSM and cloud-KMS backends.
func NewEnvelopeFileStore(dir string, w KeyWrapper) (KeyStorage, error) {
	if w == nil {
		return nil, fmt.Errorf("keymanager: nil key wrapper")
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	return &envelopeFileStore{dir: dir, wrapper: w}, nil
}

func (s *envelopeFileStore) path(keyID string) string { return filepath.Join(s.dir, keyID+".ekey") }

func sealWithDEK(dek, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(dek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func openWithDEK(dek, data []byte) ([]byte, error) {
	block, err := aes.NewCipher(dek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(data) < gcm.NonceSize() {
		return nil, fmt.Errorf("keymanager: corrupt sealed record")
	}
	nonce, ct := data[:gcm.NonceSize()], data[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ct, nil)
}

func (s *envelopeFileStore) Put(rec Record) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, err := json.Marshal(rec)
	if err != nil {
		return err
	}
	dek := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, dek); err != nil {
		return err
	}
	sealed, err := sealWithDEK(dek, b)
	if err != nil {
		return err
	}
	wrapped, err := s.wrapper.Wrap(dek)
	if err != nil {
		return fmt.Errorf("keymanager: wrap DEK: %w", err)
	}
	out, err := json.Marshal(envelopeRecord{Wrapper: s.wrapper.Name(), WrappedDEK: wrapped, Sealed: sealed})
	if err != nil {
		return err
	}
	return os.WriteFile(s.path(rec.Info.KeyID), out, 0o600)
}

func (s *envelopeFileStore) Get(keyID string) (Record, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	data, err := os.ReadFile(s.path(keyID))
	if errors.Is(err, os.ErrNotExist) {
		return Record{}, ErrKeyNotFound
	}
	if err != nil {
		return Record{}, err
	}
	var env envelopeRecord
	if err := json.Unmarshal(data, &env); err != nil {
		return Record{}, err
	}
	dek, err := s.wrapper.Unwrap(env.WrappedDEK)
	if err != nil {
		return Record{}, fmt.Errorf("keymanager: unwrap DEK: %w", err)
	}
	plain, err := openWithDEK(dek, env.Sealed)
	if err != nil {
		return Record{}, err
	}
	var rec Record
	if err := json.Unmarshal(plain, &rec); err != nil {
		return Record{}, err
	}
	return rec, nil
}

func (s *envelopeFileStore) List() ([]types.KeyInfo, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, err
	}
	var out []types.KeyInfo
	for _, e := range entries {
		if filepath.Ext(e.Name()) != ".ekey" {
			continue
		}
		id := e.Name()[:len(e.Name())-len(".ekey")]
		rec, err := s.Get(id)
		if err != nil {
			continue
		}
		out = append(out, rec.Info)
	}
	return out, nil
}

func (s *envelopeFileStore) Update(info types.KeyInfo) error {
	rec, err := s.Get(info.KeyID)
	if err != nil {
		return err
	}
	rec.Info = info
	return s.Put(rec)
}
