package audit

import (
	"encoding/base64"

	"github.com/privyq/privyq/core-go/internal/signatures"
	"github.com/privyq/privyq/core-go/pkg/types"
)

// VerifyResult reports what passed and what failed for an entry (ARCH §15.3).
type VerifyResult struct {
	Verified        bool
	SignatureValid  bool
	ChainValid      bool
	PolicyCompliant bool
	Detail          string
}

// PublicKeyLookup resolves a signing public key id to its raw bytes.
type PublicKeyLookup func(publicKeyID string) (publicKey []byte, algorithm string, err error)

// VerifySignature checks the Dilithium signature over an entry's canonical
// payload using the public key referenced by the entry.
func VerifySignature(ev types.Evidence, lookup PublicKeyLookup) (bool, error) {
	pub, algo, err := lookup(ev.PublicKeyID)
	if err != nil {
		return false, err
	}
	scheme, err := signatures.New(algo)
	if err != nil {
		return false, err
	}
	sig, err := base64.StdEncoding.DecodeString(ev.Signature)
	if err != nil {
		return false, err
	}
	payload, err := canonicalPayload(ev)
	if err != nil {
		return false, err
	}
	return scheme.Verify(pub, payload, sig), nil
}

// Verify checks a single entry's signature and, given its predecessor, its
// chain linkage. Pass parent=nil for the genesis entry.
func Verify(ev types.Evidence, parent *types.Evidence, lookup PublicKeyLookup) VerifyResult {
	res := VerifyResult{PolicyCompliant: ev.PolicyEvaluation.Granted() || ev.Result == "denied"}

	sigOK, err := VerifySignature(ev, lookup)
	if err != nil {
		return VerifyResult{Detail: "signature check error: " + err.Error()}
	}
	res.SignatureValid = sigOK

	switch {
	case parent == nil:
		res.ChainValid = ev.ParentHash == types.GenesisHash
	default:
		h, err := EntryHash(*parent)
		if err != nil {
			res.Detail = "parent hash error: " + err.Error()
			return res
		}
		res.ChainValid = ev.ParentHash == h
	}

	res.Verified = res.SignatureValid && res.ChainValid
	if res.Verified {
		res.Detail = "entry verified"
	} else if !res.SignatureValid {
		res.Detail = "signature invalid (entry tampered or forged)"
	} else {
		res.Detail = "chain broken (parent hash mismatch — entry reordered, edited, or deleted)"
	}
	return res
}

// VerifyChain verifies an ordered slice of entries end to end. It returns false
// on the first entry whose signature or chain link fails.
func VerifyChain(entries []types.Evidence, lookup PublicKeyLookup) (bool, string) {
	var parent *types.Evidence
	for i := range entries {
		res := Verify(entries[i], parent, lookup)
		if !res.Verified {
			return false, entries[i].EvidenceID + ": " + res.Detail
		}
		parent = &entries[i]
	}
	return true, "chain verified"
}
