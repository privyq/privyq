// Package audit generates and verifies cryptographically verifiable privacy
// evidence (ARCH §15, BP §15). Every access — granted or denied — yields a
// signed entry that is hash-chained to its predecessor, so the log proves
// access was policy-compliant and any tampering is detectable.
package audit

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/privyq/privyq/core-go/internal/signatures"
	"github.com/privyq/privyq/core-go/pkg/types"
)

// GenerateParams carries everything needed to mint one evidence entry.
type GenerateParams struct {
	Actor        types.Identity
	ResourceID   string
	ResourceHash string
	Policy       types.Policy
	Operation    string // protect | access
	Evaluation   types.PolicyEvaluation
	SigningKeyID string
	Algorithm    string // e.g. dilithium_3
	ParentHash   string // GenesisHash for the first entry
	Position     int64
	Timestamp    time.Time
	Metadata     map[string]string
}

// Generate builds, signs, and returns an evidence entry. The signature covers
// the canonical payload (all fields except the signature itself).
func Generate(p GenerateParams, scheme signatures.Scheme, signPrivKey []byte) (types.Evidence, error) {
	ts := p.Timestamp
	if ts.IsZero() {
		ts = time.Now().UTC()
	}
	parent := p.ParentHash
	if parent == "" {
		parent = types.GenesisHash
	}
	ev := types.Evidence{
		EvidenceID:       uuid.NewString(),
		Version:          types.EvidenceVersion,
		Timestamp:        ts.Format(time.RFC3339),
		Actor:            p.Actor,
		ResourceID:       p.ResourceID,
		ResourceHash:     p.ResourceHash,
		Policy:           p.Policy,
		Operation:        p.Operation,
		Result:           p.Evaluation.Decision,
		PolicyEvaluation: p.Evaluation,
		PublicKeyID:      p.SigningKeyID,
		SigningAlgorithm: p.Algorithm,
		ParentHash:       parent,
		Position:         p.Position,
		Metadata:         p.Metadata,
	}
	payload, err := canonicalPayload(ev)
	if err != nil {
		return types.Evidence{}, err
	}
	sig, err := scheme.Sign(signPrivKey, payload)
	if err != nil {
		return types.Evidence{}, fmt.Errorf("audit: sign: %w", err)
	}
	ev.Signature = base64.StdEncoding.EncodeToString(sig)
	return ev, nil
}

// normalize makes an evidence entry serialize identically regardless of how it
// was constructed. A protobuf round-trip (as the gateway/SDK do for the /verify
// path) turns nil slices into empty ones; without this, the signed JSON would
// differ between sign time and verify time for entries with empty policies.
func normalize(ev types.Evidence) types.Evidence {
	if ev.Policy.Conditions == nil {
		ev.Policy.Conditions = []types.Condition{}
	}
	if ev.PolicyEvaluation.EvaluatedConditions == nil {
		ev.PolicyEvaluation.EvaluatedConditions = []types.ConditionResult{}
	}
	return ev
}

// canonicalPayload returns the deterministic bytes that are signed: the entry
// normalized, with its Signature field cleared.
func canonicalPayload(ev types.Evidence) ([]byte, error) {
	ev = normalize(ev)
	ev.Signature = ""
	b, err := json.Marshal(ev)
	if err != nil {
		return nil, fmt.Errorf("audit: marshal: %w", err)
	}
	return b, nil
}

// EntryHash returns the hex SHA-256 of the full (normalized) entry. It is the
// value the next entry stores as its ParentHash, forming the chain.
func EntryHash(ev types.Evidence) (string, error) {
	b, err := json.Marshal(normalize(ev))
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:]), nil
}
