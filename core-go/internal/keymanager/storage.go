// Package keymanager owns the key lifecycle: generation, storage, rotation,
// revocation, and the org→dept→user hierarchy (ARCH §13).
//
// KeyStorage abstracts the persistence backend so local, HSM, cloud-KMS, or
// database backends are interchangeable (ARCH §13.3, §25.3). v1.0 ships an
// in-memory store and a local AES-256-GCM-encrypted file store; HSM/cloud
// backends implement the same interface later.
package keymanager

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// ErrKeyNotFound is returned when a key id is unknown.
var ErrKeyNotFound = errors.New("keymanager: key not found")

// Record is a stored key: public metadata plus the (sensitive) private key.
type Record struct {
	Info       types.KeyInfo `json:"info"`
	PrivateKey []byte        `json:"private_key"`
}

// KeyStorage is the persistence contract for keys.
type KeyStorage interface {
	Put(rec Record) error
	Get(keyID string) (Record, error)
	List() ([]types.KeyInfo, error)
	Update(info types.KeyInfo) error
}

// ─────────────────────────── in-memory backend ───────────────────────────

type memoryStore struct {
	mu   sync.RWMutex
	keys map[string]Record
}

// NewMemoryStore returns a thread-safe in-memory KeyStorage (dev/testing).
func NewMemoryStore() KeyStorage {
	return &memoryStore{keys: make(map[string]Record)}
}

func (m *memoryStore) Put(rec Record) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.keys[rec.Info.KeyID] = rec
	return nil
}

func (m *memoryStore) Get(keyID string) (Record, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	rec, ok := m.keys[keyID]
	if !ok {
		return Record{}, ErrKeyNotFound
	}
	return rec, nil
}

func (m *memoryStore) List() ([]types.KeyInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]types.KeyInfo, 0, len(m.keys))
	for _, r := range m.keys {
		out = append(out, r.Info)
	}
	return out, nil
}

func (m *memoryStore) Update(info types.KeyInfo) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	rec, ok := m.keys[info.KeyID]
	if !ok {
		return ErrKeyNotFound
	}
	rec.Info = info
	m.keys[info.KeyID] = rec
	return nil
}

// ─────────────────────── local encrypted file backend ───────────────────────

type localFileStore struct {
	mu     sync.RWMutex
	dir    string
	aesKey []byte
}

// NewLocalFileStore stores each key as an AES-256-GCM-encrypted JSON file under
// dir. The master password is stretched to a 256-bit key with SHA-256
// (ARCH §13.3 "local encrypted storage" — dev/small-scale, not production HSM).
func NewLocalFileStore(dir, masterPassword string) (KeyStorage, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	sum := sha256.Sum256([]byte(masterPassword))
	return &localFileStore{dir: dir, aesKey: sum[:]}, nil
}

func (s *localFileStore) path(keyID string) string {
	return filepath.Join(s.dir, keyID+".key")
}

func (s *localFileStore) seal(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(s.aesKey)
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

func (s *localFileStore) open(data []byte) ([]byte, error) {
	block, err := aes.NewCipher(s.aesKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(data) < gcm.NonceSize() {
		return nil, fmt.Errorf("keymanager: corrupt key file")
	}
	nonce, ct := data[:gcm.NonceSize()], data[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ct, nil)
}

func (s *localFileStore) Put(rec Record) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, err := json.Marshal(rec)
	if err != nil {
		return err
	}
	sealed, err := s.seal(b)
	if err != nil {
		return err
	}
	return os.WriteFile(s.path(rec.Info.KeyID), sealed, 0o600)
}

func (s *localFileStore) Get(keyID string) (Record, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	data, err := os.ReadFile(s.path(keyID))
	if errors.Is(err, os.ErrNotExist) {
		return Record{}, ErrKeyNotFound
	}
	if err != nil {
		return Record{}, err
	}
	plain, err := s.open(data)
	if err != nil {
		return Record{}, err
	}
	var rec Record
	if err := json.Unmarshal(plain, &rec); err != nil {
		return Record{}, err
	}
	return rec, nil
}

func (s *localFileStore) List() ([]types.KeyInfo, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, err
	}
	var out []types.KeyInfo
	for _, e := range entries {
		if filepath.Ext(e.Name()) != ".key" {
			continue
		}
		id := e.Name()[:len(e.Name())-4]
		rec, err := s.Get(id)
		if err != nil {
			continue
		}
		out = append(out, rec.Info)
	}
	return out, nil
}

func (s *localFileStore) Update(info types.KeyInfo) error {
	rec, err := s.Get(info.KeyID)
	if err != nil {
		return err
	}
	rec.Info = info
	return s.Put(rec)
}
