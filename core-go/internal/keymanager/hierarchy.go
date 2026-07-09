package keymanager

import (
	"sync"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// Hierarchy tracks the organization → department → user key relationships
// described in ARCH §13.1. It is an index over key metadata used for
// organizational key management and delegated authority; it does not itself
// hold key material.
type Hierarchy struct {
	mu sync.RWMutex
	// org -> department -> owner -> key ids
	tree map[string]map[string]map[string][]string
}

// NewHierarchy returns an empty hierarchy index.
func NewHierarchy() *Hierarchy {
	return &Hierarchy{tree: make(map[string]map[string]map[string][]string)}
}

// Register places a key into the hierarchy by its organization, department
// (from metadata), and owner.
func (h *Hierarchy) Register(info types.KeyInfo) {
	h.mu.Lock()
	defer h.mu.Unlock()
	org := orDefault(info.Organization, "_root")
	dept := orDefault(info.Metadata["department"], "_general")
	owner := orDefault(info.Owner, "_unassigned")
	if h.tree[org] == nil {
		h.tree[org] = map[string]map[string][]string{}
	}
	if h.tree[org][dept] == nil {
		h.tree[org][dept] = map[string][]string{}
	}
	h.tree[org][dept][owner] = append(h.tree[org][dept][owner], info.KeyID)
}

// KeysFor returns the key ids registered for a given org/department/owner.
// Empty arguments act as wildcards from the top down.
func (h *Hierarchy) KeysFor(org, dept, owner string) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	var out []string
	for o, depts := range h.tree {
		if org != "" && org != o {
			continue
		}
		for d, owners := range depts {
			if dept != "" && dept != d {
				continue
			}
			for w, ids := range owners {
				if owner != "" && owner != w {
					continue
				}
				out = append(out, ids...)
			}
		}
	}
	return out
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
