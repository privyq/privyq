package audit

import (
	"encoding/base64"
	"testing"
	"time"

	"github.com/privyq/privyq/core-go/internal/signatures"
	"github.com/privyq/privyq/core-go/pkg/types"
)

// helper: a signing scheme + key pair + a lookup that returns the public key.
func signer(t *testing.T) (signatures.Scheme, []byte, PublicKeyLookup) {
	t.Helper()
	scheme, err := signatures.New("dilithium_3")
	if err != nil {
		t.Fatal(err)
	}
	pub, priv, err := scheme.GenerateKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	lookup := func(string) ([]byte, string, error) { return pub, "dilithium_3", nil }
	return scheme, priv, lookup
}

func params(pos int64, parent string) GenerateParams {
	return GenerateParams{
		Actor:        types.Identity{UserID: "doctor_123", Role: "doctor"},
		ResourceID:   "patient_001",
		ResourceHash: "abc123",
		Operation:    "access",
		Evaluation:   types.PolicyEvaluation{Decision: "granted", Reason: "ok"},
		SigningKeyID: "key_1",
		Algorithm:    "dilithium_3",
		ParentHash:   parent,
		Position:     pos,
		Timestamp:    time.Unix(1_700_000_000+pos, 0).UTC(),
	}
}

func TestGenerateAndVerify(t *testing.T) {
	scheme, priv, lookup := signer(t)
	ev, err := Generate(params(0, types.GenesisHash), scheme, priv)
	if err != nil {
		t.Fatal(err)
	}
	res := Verify(ev, nil, lookup)
	if !res.Verified {
		t.Fatalf("genesis entry should verify: %s", res.Detail)
	}
}

func TestTamperDetection(t *testing.T) {
	scheme, priv, lookup := signer(t)
	ev, _ := Generate(params(0, types.GenesisHash), scheme, priv)

	// Edit the actor after signing — signature must fail.
	tampered := ev
	tampered.Actor.Role = "admin"
	if Verify(tampered, nil, lookup).SignatureValid {
		t.Fatal("edited entry must fail signature verification")
	}

	// Forge a signature — must fail.
	forged := ev
	forged.Signature = base64.StdEncoding.EncodeToString([]byte("not a real signature"))
	if Verify(forged, nil, lookup).SignatureValid {
		t.Fatal("forged signature must fail")
	}
}

func TestChainIntegrityAndDeletionDetection(t *testing.T) {
	scheme, priv, lookup := signer(t)
	e0, _ := Generate(params(0, types.GenesisHash), scheme, priv)
	h0, _ := EntryHash(e0)
	e1, _ := Generate(params(1, h0), scheme, priv)
	h1, _ := EntryHash(e1)
	e2, _ := Generate(params(2, h1), scheme, priv)

	if ok, detail := VerifyChain([]types.Evidence{e0, e1, e2}, lookup); !ok {
		t.Fatalf("intact chain should verify: %s", detail)
	}
	// Delete the middle entry — the chain must break.
	if ok, _ := VerifyChain([]types.Evidence{e0, e2}, lookup); ok {
		t.Fatal("deleting an entry must break the chain")
	}
	// Reorder — must break.
	if ok, _ := VerifyChain([]types.Evidence{e1, e0, e2}, lookup); ok {
		t.Fatal("reordering must break the chain")
	}
}

func TestEvidenceStoreChaining(t *testing.T) {
	scheme, priv, lookup := signer(t)
	store := NewMemoryEvidenceStore()
	for i := int64(0); i < 5; i++ {
		parent, _ := store.LastHash()
		ev, err := Generate(params(i, parent), scheme, priv)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := store.Append(ev); err != nil {
			t.Fatal(err)
		}
	}
	all, _ := store.All()
	if len(all) != 5 {
		t.Fatalf("expected 5 entries, got %d", len(all))
	}
	if ok, detail := VerifyChain(all, lookup); !ok {
		t.Fatalf("stored chain should verify: %s", detail)
	}
}
