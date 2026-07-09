package audit

import (
	"sort"
	"sync"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// Filter narrows an evidence-log query (ARCH §15.4).
type Filter struct {
	ResourceID string
	ActorID    string
	StartTime  string
	EndTime    string
}

// EvidenceStore persists the append-only evidence chain. v1.0 ships an
// in-memory store; Phase 4 adds a PostgreSQL implementation of this interface.
type EvidenceStore interface {
	// Append stores an entry and returns its 0-based position.
	Append(ev types.Evidence) (int64, error)
	// LastHash returns the EntryHash of the newest entry, or GenesisHash if empty.
	LastHash() (string, error)
	// Count returns the number of entries (the next position).
	Count() (int64, error)
	// List returns entries matching filter in chain order.
	List(f Filter) ([]types.Evidence, error)
	// All returns every entry in chain order.
	All() ([]types.Evidence, error)
}

type memoryEvidenceStore struct {
	mu       sync.RWMutex
	entries  []types.Evidence
	lastHash string
}

// NewMemoryEvidenceStore returns an in-memory EvidenceStore.
func NewMemoryEvidenceStore() EvidenceStore {
	return &memoryEvidenceStore{lastHash: types.GenesisHash}
}

func (s *memoryEvidenceStore) Append(ev types.Evidence) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	pos := int64(len(s.entries))
	s.entries = append(s.entries, ev)
	h, err := EntryHash(ev)
	if err != nil {
		return pos, err
	}
	s.lastHash = h
	return pos, nil
}

func (s *memoryEvidenceStore) LastHash() (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastHash, nil
}

func (s *memoryEvidenceStore) Count() (int64, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return int64(len(s.entries)), nil
}

func (s *memoryEvidenceStore) All() ([]types.Evidence, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]types.Evidence, len(s.entries))
	copy(out, s.entries)
	return out, nil
}

func (s *memoryEvidenceStore) List(f Filter) ([]types.Evidence, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []types.Evidence
	for _, e := range s.entries {
		if f.ResourceID != "" && e.ResourceID != f.ResourceID {
			continue
		}
		if f.ActorID != "" && e.Actor.UserID != f.ActorID {
			continue
		}
		if f.StartTime != "" && e.Timestamp < f.StartTime {
			continue
		}
		if f.EndTime != "" && e.Timestamp > f.EndTime {
			continue
		}
		out = append(out, e)
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Position < out[j].Position })
	return out, nil
}
