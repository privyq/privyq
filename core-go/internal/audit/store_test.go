package audit

import (
	"testing"

	"github.com/privyq/privyq/core-go/pkg/types"
)

func TestMemoryStoreLastHashCountAndFilter(t *testing.T) {
	scheme, priv, _ := signer(t)
	store := NewMemoryEvidenceStore()

	// Empty store: genesis hash, zero count.
	if h, _ := store.LastHash(); h != types.GenesisHash {
		t.Fatalf("empty store LastHash = %q, want genesis", h)
	}
	if n, _ := store.Count(); n != 0 {
		t.Fatalf("empty store Count = %d", n)
	}

	// Append entries for two actors/resources.
	for i := int64(0); i < 4; i++ {
		p := params(i, mustLast(t, store))
		if i%2 == 0 {
			p.Actor.UserID = "alice"
			p.ResourceID = "res_a"
		} else {
			p.Actor.UserID = "bob"
			p.ResourceID = "res_b"
		}
		ev, _ := Generate(p, scheme, priv)
		if _, err := store.Append(ev); err != nil {
			t.Fatal(err)
		}
	}
	if n, _ := store.Count(); n != 4 {
		t.Fatalf("Count = %d, want 4", n)
	}
	byActor, _ := store.List(Filter{ActorID: "alice"})
	if len(byActor) != 2 {
		t.Fatalf("actor filter = %d, want 2", len(byActor))
	}
	byRes, _ := store.List(Filter{ResourceID: "res_b"})
	if len(byRes) != 2 {
		t.Fatalf("resource filter = %d, want 2", len(byRes))
	}
	windowed, _ := store.List(Filter{StartTime: "1970-01-01T00:00:00Z", EndTime: "2100-01-01T00:00:00Z"})
	if len(windowed) != 4 {
		t.Fatalf("time window = %d, want 4", len(windowed))
	}
}

func TestVerifyChainEmptyIsValid(t *testing.T) {
	_, _, lookup := signer(t)
	ok, _ := VerifyChain(nil, lookup)
	if !ok {
		t.Fatal("an empty chain is trivially valid")
	}
}

func mustLast(t *testing.T, s EvidenceStore) string {
	t.Helper()
	h, err := s.LastHash()
	if err != nil {
		t.Fatal(err)
	}
	return h
}
