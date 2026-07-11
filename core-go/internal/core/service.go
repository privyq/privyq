// Package core is the orchestration layer of the cryptographic core. It wires
// together key management, hybrid encryption, the policy engine, and the audit
// chain to implement the Protect and Access flows (ARCH §16). It is transport-
// agnostic: the gRPC layer translates protobuf to/from these methods.
package core

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/privyq/privyq/core-go/internal/audit"
	"github.com/privyq/privyq/core-go/internal/encryption"
	"github.com/privyq/privyq/core-go/internal/kem"
	"github.com/privyq/privyq/core-go/internal/keymanager"
	"github.com/privyq/privyq/core-go/internal/policies"
	"github.com/privyq/privyq/core-go/internal/retention"
	"github.com/privyq/privyq/core-go/internal/signatures"
	"github.com/privyq/privyq/core-go/pkg/types"
)

// ErrPolicyViolation is returned by Access when the policy denies the request.
// It carries the evidence so callers can still surface/verify the denial.
type ErrPolicyViolation struct {
	Reason   string
	Evidence types.Evidence
}

func (e *ErrPolicyViolation) Error() string { return "policy violation: " + e.Reason }

// Service is the core orchestrator.
type Service struct {
	Keys     *keymanager.Manager
	Evidence audit.EvidenceStore
	version  string

	chainMu sync.Mutex // serializes evidence generation to keep the chain ordered
}

// New builds a Service from a key manager and evidence store.
func New(keys *keymanager.Manager, evidence audit.EvidenceStore, version string) *Service {
	return &Service{Keys: keys, Evidence: evidence, version: version}
}

// Protect encrypts plaintext under a policy and returns the serialized
// ProtectedData envelope plus the audit evidence for the protect event.
func (s *Service) Protect(plaintext []byte, policy types.Policy, algorithm, keyID, resourceID string, actor types.Identity) (*types.ProtectedData, types.Evidence, error) {
	if algorithm == "" {
		algorithm = types.DefaultKEM
	}
	if !kem.Supported(algorithm) {
		return nil, types.Evidence{}, fmt.Errorf("unsupported KEM algorithm %q", algorithm)
	}
	if policy.Version == "" {
		policy.Version = types.PolicyVersion
	}
	if policy.Combination == "" {
		policy.Combination = "all"
	}

	// Resolve or mint the encryption key.
	if keyID == "" {
		info, err := s.Keys.Generate(algorithm, types.KeyEncryption, actor.Organization, actor.UserID, nil)
		if err != nil {
			return nil, types.Evidence{}, err
		}
		keyID = info.KeyID
	}
	pub, keyAlgo, err := s.Keys.PublicKey(keyID)
	if err != nil {
		return nil, types.Evidence{}, err
	}
	scheme, err := kem.New(keyAlgo)
	if err != nil {
		return nil, types.Evidence{}, err
	}

	sealed, err := encryption.Encrypt(scheme, pub, plaintext)
	if err != nil {
		return nil, types.Evidence{}, err
	}
	resourceHash := sealed.ResourceHash()

	// Sign the ciphertext with the system signing key.
	signKey, err := s.Keys.EnsureSigningKey()
	if err != nil {
		return nil, types.Evidence{}, err
	}
	signPriv, signAlgo, err := s.Keys.PrivateKey(signKey.KeyID)
	if err != nil {
		return nil, types.Evidence{}, err
	}
	sigScheme, err := signatures.New(signAlgo)
	if err != nil {
		return nil, types.Evidence{}, err
	}
	sig, err := sigScheme.Sign(signPriv, sealed.Ciphertext)
	if err != nil {
		return nil, types.Evidence{}, err
	}

	if resourceID == "" {
		resourceID = resourceHash[:16]
	}
	envelope := &types.ProtectedData{
		Version:      types.EnvelopeVersion,
		Algorithm:    keyAlgo,
		KeyID:        keyID,
		EncryptedKey: base64.StdEncoding.EncodeToString(sealed.EncapsulatedKey),
		Nonce:        base64.StdEncoding.EncodeToString(sealed.Nonce),
		Ciphertext:   base64.StdEncoding.EncodeToString(sealed.Ciphertext),
		Signature:    base64.StdEncoding.EncodeToString(sig),
		SignKeyID:    signKey.KeyID,
		Policy:       policy,
		ResourceID:   resourceID,
		ResourceHash: resourceHash,
		Metadata: map[string]string{
			"created_at": time.Now().UTC().Format(time.RFC3339),
			"created_by": actor.UserID,
		},
	}

	eval := types.PolicyEvaluation{Decision: "granted", Reason: "data protected by owner"}
	ev, err := s.appendEvidence(audit.GenerateParams{
		Actor: actor, ResourceID: resourceID, ResourceHash: resourceHash,
		Policy: policy, Operation: "protect", Evaluation: eval,
	})
	if err != nil {
		return nil, types.Evidence{}, err
	}
	return envelope, ev, nil
}

// Access evaluates the embedded policy against identity+context and, if
// granted, decrypts and returns the plaintext. Every attempt — granted or
// denied — produces a chained evidence entry.
func (s *Service) Access(protectedData []byte, identity types.Identity, ctx types.Context) ([]byte, types.Evidence, error) {
	var envelope types.ProtectedData
	if err := json.Unmarshal(protectedData, &envelope); err != nil {
		return nil, types.Evidence{}, fmt.Errorf("invalid protected data: %w", err)
	}

	eval := policies.Evaluate(envelope.Policy, identity, ctx)

	ev, err := s.appendEvidence(audit.GenerateParams{
		Actor: identity, ResourceID: envelope.ResourceID, ResourceHash: envelope.ResourceHash,
		Policy: envelope.Policy, Operation: "access", Evaluation: eval,
		Metadata: map[string]string{"ip_address": ctx.IPAddress, "session_id": ctx.SessionID, "user_agent": ctx.UserAgent},
	})
	if err != nil {
		return nil, types.Evidence{}, err
	}

	if !eval.Granted() {
		return nil, ev, &ErrPolicyViolation{Reason: eval.Reason, Evidence: ev}
	}

	// Policy granted: verify the ciphertext signature, then decrypt.
	if err := s.verifyEnvelopeSignature(envelope); err != nil {
		return nil, ev, err
	}
	priv, keyAlgo, err := s.Keys.PrivateKey(envelope.KeyID)
	if err != nil {
		return nil, ev, err
	}
	scheme, err := kem.New(keyAlgo)
	if err != nil {
		return nil, ev, err
	}
	sealed, err := decodeSealed(envelope)
	if err != nil {
		return nil, ev, err
	}
	plaintext, err := encryption.Decrypt(scheme, priv, sealed)
	if err != nil {
		return nil, ev, err
	}
	return plaintext, ev, nil
}

func (s *Service) verifyEnvelopeSignature(env types.ProtectedData) error {
	pub, algo, err := s.Keys.PublicKey(env.SignKeyID)
	if err != nil {
		return err
	}
	scheme, err := signatures.New(algo)
	if err != nil {
		return err
	}
	ct, err := base64.StdEncoding.DecodeString(env.Ciphertext)
	if err != nil {
		return err
	}
	sig, err := base64.StdEncoding.DecodeString(env.Signature)
	if err != nil {
		return err
	}
	if !scheme.Verify(pub, ct, sig) {
		return errors.New("ciphertext signature verification failed (tampered protected data)")
	}
	return nil
}

// Sign signs a message with a signing key (creating one if keyID is empty).
func (s *Service) Sign(message []byte, keyID string) (string, string, string, error) {
	if keyID == "" {
		info, err := s.Keys.EnsureSigningKey()
		if err != nil {
			return "", "", "", err
		}
		keyID = info.KeyID
	}
	priv, algo, err := s.Keys.PrivateKey(keyID)
	if err != nil {
		return "", "", "", err
	}
	scheme, err := signatures.New(algo)
	if err != nil {
		return "", "", "", err
	}
	sig, err := scheme.Sign(priv, message)
	if err != nil {
		return "", "", "", err
	}
	return base64.StdEncoding.EncodeToString(sig), keyID, algo, nil
}

// Verify checks a signature over message with the referenced public key.
func (s *Service) Verify(message []byte, signatureB64, publicKeyID string) (bool, error) {
	pub, algo, err := s.Keys.PublicKey(publicKeyID)
	if err != nil {
		return false, err
	}
	scheme, err := signatures.New(algo)
	if err != nil {
		return false, err
	}
	sig, err := base64.StdEncoding.DecodeString(signatureB64)
	if err != nil {
		return false, err
	}
	return scheme.Verify(pub, message, sig), nil
}

// Seal produces a self-describing post-quantum signature over data — the v2
// `seal()` verb. If keyID is empty and algorithm is set, a signing key of that
// algorithm is generated; otherwise the default signing key is used.
func (s *Service) Seal(data []byte, keyID, algorithm string) (types.Sealed, error) {
	if keyID == "" && algorithm != "" {
		info, err := s.Keys.Generate(algorithm, types.KeySigning, "", "", nil)
		if err != nil {
			return types.Sealed{}, err
		}
		keyID = info.KeyID
	}
	sigB64, usedKey, algo, err := s.Sign(data, keyID)
	if err != nil {
		return types.Sealed{}, err
	}
	sum := sha256.Sum256(data)
	return types.Sealed{
		DataHash:  hex.EncodeToString(sum[:]),
		Signature: sigB64,
		Algorithm: algo,
		KeyID:     usedKey,
		SealedAt:  time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// VerifySeal checks a Sealed signature against data: the data hash must match (when
// present) and the signature must verify under the sealing key.
func (s *Service) VerifySeal(data []byte, sealed types.Sealed) (bool, error) {
	if sealed.DataHash != "" {
		sum := sha256.Sum256(data)
		if hex.EncodeToString(sum[:]) != sealed.DataHash {
			return false, nil
		}
	}
	return s.Verify(data, sealed.Signature, sealed.KeyID)
}

// GenerateEvidence mints and stores a standalone evidence entry.
func (s *Service) GenerateEvidence(p audit.GenerateParams) (types.Evidence, error) {
	return s.appendEvidence(p)
}

// RetentionSummary reports what a retention sweep did/found.
type RetentionSummary struct {
	KeysExpired        int
	EvidencePastCutoff int
}

// RunRetention applies a retention policy as of now: it expires keys past their
// ExpiresAt, and reports how many evidence entries are past the retention cutoff
// (archival candidates). The signed evidence chain is not pruned in place, so it
// stays end-to-end verifiable; archival/export is a separate, explicit step.
func (s *Service) RunRetention(p retention.Policy, now time.Time) (RetentionSummary, error) {
	var sum RetentionSummary
	keys, err := s.ListKeys()
	if err != nil {
		return sum, err
	}
	for _, id := range retention.ExpiredKeys(keys, now) {
		if _, err := s.Keys.Expire(id); err != nil {
			return sum, err
		}
		sum.KeysExpired++
	}
	all, err := s.Evidence.All()
	if err != nil {
		return sum, err
	}
	_, expired := p.PartitionEvidence(all, now)
	sum.EvidencePastCutoff = len(expired)
	return sum, nil
}

// ExportEvidence renders the (filtered) evidence chain for compliance reporting
// in json | csv | pdf, tagged with whether the whole chain still verifies.
func (s *Service) ExportEvidence(f audit.Filter, format string) (content []byte, contentType, filename string, err error) {
	entries, err := s.Evidence.List(f)
	if err != nil {
		return nil, "", "", err
	}
	all, _ := s.Evidence.All()
	chainOK, _ := audit.VerifyChain(all, s.publicKeyLookup())
	return audit.Export(entries, format, chainOK)
}

// VerifyEvidence checks an entry's signature and (against the stored chain) its
// linkage; optionally re-evaluates the embedded policy.
func (s *Service) VerifyEvidence(ev types.Evidence, reevaluate bool) audit.VerifyResult {
	lookup := s.publicKeyLookup()
	all, _ := s.Evidence.All()
	var parent *types.Evidence
	for i := range all {
		if all[i].EvidenceID == ev.EvidenceID && i > 0 {
			parent = &all[i-1]
		}
	}
	res := audit.Verify(ev, parent, lookup)
	if reevaluate {
		re := policies.Evaluate(ev.Policy, ev.Actor, types.Context{Timestamp: ev.Timestamp})
		res.PolicyCompliant = re.Decision == ev.Result
	}
	return res
}

// EvidenceLog returns evidence entries matching a filter, with a chain-wide
// verification flag.
func (s *Service) EvidenceLog(f audit.Filter, page, pageSize int) ([]types.Evidence, int, bool, error) {
	entries, err := s.Evidence.List(f)
	if err != nil {
		return nil, 0, false, err
	}
	all, _ := s.Evidence.All()
	chainOK, _ := audit.VerifyChain(all, s.publicKeyLookup())
	total := len(entries)
	if pageSize <= 0 {
		pageSize = 20
	}
	if page <= 0 {
		page = 1
	}
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return entries[start:end], total, chainOK, nil
}

// ListKeys returns public metadata for every managed key.
func (s *Service) ListKeys() ([]types.KeyInfo, error) { return s.Keys.List() }

// EvaluatePolicy runs the policy engine against an identity+context WITHOUT
// decrypting anything or writing evidence. Used by the playground.
func (s *Service) EvaluatePolicy(policy types.Policy, identity types.Identity, ctx types.Context) types.PolicyEvaluation {
	return policies.Evaluate(policy, identity, ctx)
}

// Check is the v2 authorization decision — the PDP `check()` verb (v2 blueprint
// §6). It evaluates the policy (taken from the protected envelope when provided,
// otherwise the explicit policy) against identity+context WITHOUT decrypting, and
// returns a self-explaining Decision. When emitEvidence is set it records a signed,
// chained evidence entry for the decision (operation "check"), so denials are as
// auditable as grants.
func (s *Service) Check(protectedData []byte, policy types.Policy, identity types.Identity, ctx types.Context, emitEvidence bool) (types.Decision, types.Evidence, error) {
	resourceID, resourceHash := "", ""
	if len(protectedData) > 0 {
		var envelope types.ProtectedData
		if err := json.Unmarshal(protectedData, &envelope); err != nil {
			return types.Decision{}, types.Evidence{}, fmt.Errorf("invalid protected data: %w", err)
		}
		policy = envelope.Policy
		resourceID, resourceHash = envelope.ResourceID, envelope.ResourceHash
	}

	decision := policies.Decide(policy, identity, ctx)
	if !emitEvidence {
		return decision, types.Evidence{}, nil
	}
	ev, err := s.appendEvidence(audit.GenerateParams{
		Actor: identity, ResourceID: resourceID, ResourceHash: resourceHash,
		Policy: policy, Operation: "check", Evaluation: decision.AsEvaluation(),
		Metadata: map[string]string{"ip_address": ctx.IPAddress, "session_id": ctx.SessionID, "user_agent": ctx.UserAgent},
	})
	if err != nil {
		return decision, types.Evidence{}, err
	}
	return decision, ev, nil
}

// Version reports the core version.
func (s *Service) Version() string { return s.version }

// appendEvidence generates a signed, chained evidence entry and stores it. The
// chain mutex guarantees the parent-hash read and append are atomic.
func (s *Service) appendEvidence(p audit.GenerateParams) (types.Evidence, error) {
	s.chainMu.Lock()
	defer s.chainMu.Unlock()

	signKey, err := s.Keys.EnsureSigningKey()
	if err != nil {
		return types.Evidence{}, err
	}
	priv, algo, err := s.Keys.PrivateKey(signKey.KeyID)
	if err != nil {
		return types.Evidence{}, err
	}
	scheme, err := signatures.New(algo)
	if err != nil {
		return types.Evidence{}, err
	}
	parent, err := s.Evidence.LastHash()
	if err != nil {
		return types.Evidence{}, err
	}
	pos, err := s.Evidence.Count()
	if err != nil {
		return types.Evidence{}, err
	}
	p.SigningKeyID = signKey.KeyID
	p.Algorithm = algo
	p.ParentHash = parent
	p.Position = pos

	ev, err := audit.Generate(p, scheme, priv)
	if err != nil {
		return types.Evidence{}, err
	}
	if _, err := s.Evidence.Append(ev); err != nil {
		return types.Evidence{}, err
	}
	return ev, nil
}

func (s *Service) publicKeyLookup() audit.PublicKeyLookup {
	return func(keyID string) ([]byte, string, error) { return s.Keys.PublicKey(keyID) }
}

func decodeSealed(env types.ProtectedData) (*encryption.Sealed, error) {
	ek, err := base64.StdEncoding.DecodeString(env.EncryptedKey)
	if err != nil {
		return nil, err
	}
	nonce, err := base64.StdEncoding.DecodeString(env.Nonce)
	if err != nil {
		return nil, err
	}
	ct, err := base64.StdEncoding.DecodeString(env.Ciphertext)
	if err != nil {
		return nil, err
	}
	return &encryption.Sealed{EncapsulatedKey: ek, Nonce: nonce, Ciphertext: ct}, nil
}

// PolicyHash returns the hex SHA-256 of a policy's canonical JSON.
func PolicyHash(p types.Policy) string {
	b, _ := json.Marshal(p)
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}
