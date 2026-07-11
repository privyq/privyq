// Package types holds the domain model shared across the PrivyQ core.
//
// These are the in-memory representations the core reasons about. The gRPC
// layer (internal/grpc) translates between these and the protobuf messages in
// pkg/pb. Keeping a hand-written domain model separate from the wire format
// keeps the crypto/policy code free of protobuf concerns (ARCH §14.3).
package types

import "encoding/json"

// Algorithm defaults (docs/blueprint.md Appendix C).
const (
	DefaultKEM       = "kyber_768"
	DefaultSignature = "dilithium_3"
	PolicyVersion    = "1.0"
	EnvelopeVersion  = "1.0"
	EvidenceVersion  = "1.0"
	GenesisHash      = "genesis"
)

// KeyType distinguishes encryption (KEM) keys from signing keys.
type KeyType string

const (
	KeyEncryption KeyType = "encryption"
	KeySigning    KeyType = "signing"
)

// KeyStatus is a key-lifecycle state (ARCH §13.2).
type KeyStatus string

const (
	StatusCreated  KeyStatus = "created"
	StatusActive   KeyStatus = "active"
	StatusRotated  KeyStatus = "rotated"
	StatusRevoked  KeyStatus = "revoked"
	StatusExpired  KeyStatus = "expired"
	StatusArchived KeyStatus = "archived"
)

// Condition is one clause of a Policy (docs/blueprint.md Appendix D.2).
type Condition struct {
	Type     string   `json:"type"`
	Operator string   `json:"operator"`
	Values   []string `json:"values"`
	Negate   bool     `json:"negate,omitempty"`
}

// Policy is the privacy policy embedded in protected data (Appendix D.1).
//
// v2 additions (Appendix D, v2 blueprint §6): DenyConditions (deny overrides
// allow), Obligations honoured on grant, and a stable PolicyID. Conditions is the
// ALLOW rule (v1 name kept so v1 envelopes still decode).
type Policy struct {
	Version        string            `json:"version"`
	Conditions     []Condition       `json:"conditions"`
	Combination    string            `json:"combination"` // all | any | custom
	CustomLogic    string            `json:"custom_logic,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
	DenyConditions []Condition       `json:"deny_conditions,omitempty"`
	Obligations    []string          `json:"obligations,omitempty"` // "mask:field", "log", "ttl:1h"
	PolicyID       string            `json:"policy_id,omitempty"`
}

// Identity + context of a requester, evaluated against a Policy.
type Identity struct {
	UserID         string            `json:"user_id"`
	Role           string            `json:"role"`
	Department     string            `json:"department"`
	Purpose        string            `json:"purpose"`
	Organization   string            `json:"organization"`
	Classification string            `json:"classification"`
	Jurisdiction   string            `json:"jurisdiction"`
	Attributes     map[string]string `json:"attributes,omitempty"`
}

// Context is ambient request information for temporal/contextual conditions.
type Context struct {
	Timestamp string `json:"timestamp"`
	IPAddress string `json:"ip_address"`
	SessionID string `json:"session_id"`
	UserAgent string `json:"user_agent"`
}

// ConditionResult records the evaluation of a single condition.
type ConditionResult struct {
	Type     string `json:"type"`
	Expected string `json:"expected"`
	Actual   string `json:"actual"`
	Result   bool   `json:"result"`
}

// PolicyEvaluation is the outcome of evaluating a Policy.
type PolicyEvaluation struct {
	Decision            string            `json:"decision"` // granted | denied
	Reason              string            `json:"reason"`
	EvaluatedConditions []ConditionResult `json:"evaluated_conditions"`
}

// Granted reports whether the evaluation permits access.
func (p PolicyEvaluation) Granted() bool { return p.Decision == "granted" }

// Decision is the v2 authorization result returned by the engine's Decide and by
// the Check RPC (v2 blueprint §6.2). It is richer than PolicyEvaluation: it names
// which conditions matched and failed, carries the obligations the enforcement
// point must honour on grant, and always explains itself.
type Decision struct {
	Allowed             bool              `json:"allowed"`
	Reason              string            `json:"reason"`
	Matched             []string          `json:"matched"`
	Failed              []string          `json:"failed"`
	Obligations         []string          `json:"obligations,omitempty"`
	PolicyID            string            `json:"policy_id,omitempty"`
	EvaluatedAt         string            `json:"evaluated_at"`
	EvaluatedConditions []ConditionResult `json:"evaluated_conditions"`
}

// Tenant is an isolated organisation in a multi-tenant deployment (v2 §19).
type Tenant struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	CreatedAt string            `json:"created_at"`
	Settings  map[string]string `json:"settings,omitempty"`
}

// Sealed is a post-quantum digital signature over arbitrary data, produced by the
// v2 `seal()` verb (v2 blueprint §5). It is self-describing so `verify()` needs no
// extra arguments.
type Sealed struct {
	DataHash  string `json:"data_hash"` // SHA-256 of the data (hex)
	Signature string `json:"signature"` // base64 signature
	Algorithm string `json:"algorithm"` // e.g. dilithium_3, falcon_512 (liboqs)
	KeyID     string `json:"key_id"`    // signing key id
	SealedAt  string `json:"sealed_at"` // RFC3339
}

// AsEvaluation projects a Decision onto the v1 PolicyEvaluation shape so existing
// callers, audit records, and the EvaluatePolicy RPC keep working unchanged.
func (d Decision) AsEvaluation() PolicyEvaluation {
	decision := "denied"
	if d.Allowed {
		decision = "granted"
	}
	return PolicyEvaluation{
		Decision:            decision,
		Reason:              d.Reason,
		EvaluatedConditions: d.EvaluatedConditions,
	}
}

// ProtectedData is the on-the-wire envelope produced by Protect and consumed by
// Access (docs/blueprint.md Appendix A.1). It carries the policy so that the
// rules travel with the ciphertext and are enforced before decryption.
type ProtectedData struct {
	Version      string            `json:"version"`
	Algorithm    string            `json:"algorithm"`
	KeyID        string            `json:"key_id"`
	EncryptedKey string            `json:"encrypted_key"` // base64 KEM ciphertext (encapsulation)
	Nonce        string            `json:"nonce"`         // base64 AES-GCM nonce
	Ciphertext   string            `json:"ciphertext"`    // base64 AES-256-GCM ciphertext
	Signature    string            `json:"signature"`     // base64 Dilithium signature over ciphertext
	SignKeyID    string            `json:"sign_key_id"`   // signing public-key id
	Policy       Policy            `json:"policy"`
	ResourceID   string            `json:"resource_id"`
	ResourceHash string            `json:"resource_hash"` // SHA-256(ciphertext) hex
	Metadata     map[string]string `json:"metadata,omitempty"`
}

// Evidence is a cryptographically verifiable audit entry (Appendix A.2, §15).
type Evidence struct {
	EvidenceID       string            `json:"evidence_id"`
	Version          string            `json:"version"`
	Timestamp        string            `json:"timestamp"`
	Actor            Identity          `json:"actor"`
	ResourceID       string            `json:"resource_id"`
	ResourceHash     string            `json:"resource_hash"`
	Policy           Policy            `json:"policy"`
	Operation        string            `json:"operation"` // protect | access
	Result           string            `json:"result"`    // granted | denied
	PolicyEvaluation PolicyEvaluation  `json:"policy_evaluation"`
	Signature        string            `json:"signature"` // base64 (excluded from signed payload)
	PublicKeyID      string            `json:"public_key_id"`
	SigningAlgorithm string            `json:"signing_algorithm"`
	ParentHash       string            `json:"parent_hash"`
	Position         int64             `json:"position"`
	Metadata         map[string]string `json:"metadata,omitempty"`
}

// KeyInfo is the public metadata for a managed key (Appendix A.3).
type KeyInfo struct {
	KeyID        string            `json:"key_id"`
	Version      string            `json:"version"`
	Algorithm    string            `json:"algorithm"`
	Type         KeyType           `json:"type"`
	PublicKey    string            `json:"public_key"` // base64
	Status       KeyStatus         `json:"status"`
	CreatedAt    string            `json:"created_at"`
	ExpiresAt    string            `json:"expires_at"`
	RotatedAt    string            `json:"rotated_at,omitempty"`
	RevokedAt    string            `json:"revoked_at,omitempty"`
	Organization string            `json:"organization,omitempty"`
	Owner        string            `json:"owner,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

// MarshalPolicy returns the canonical JSON encoding of a policy (used for hashing).
func MarshalPolicy(p Policy) ([]byte, error) { return json.Marshal(p) }
