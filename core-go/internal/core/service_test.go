package core

import (
	"encoding/json"
	"testing"

	"github.com/privyq/privyq/core-go/internal/audit"
	"github.com/privyq/privyq/core-go/internal/keymanager"
	"github.com/privyq/privyq/core-go/pkg/types"
)

func newService() *Service {
	return New(keymanager.New(keymanager.NewMemoryStore()), audit.NewMemoryEvidenceStore(), "test")
}

func medicalPolicy() types.Policy {
	return types.Policy{
		Version: "1.0", Combination: "all",
		Conditions: []types.Condition{
			{Type: "role", Operator: "equals", Values: []string{"doctor"}},
			{Type: "department", Operator: "in", Values: []string{"cardiology", "oncology"}},
			{Type: "purpose", Operator: "equals", Values: []string{"treatment"}},
		},
	}
}

// The full BP §25 defense scenario, end to end through the service.
func TestProtectAccessDenyVerify(t *testing.T) {
	svc := newService()
	plaintext := []byte("Patient: John Doe. Plan: continue beta-blocker.")
	owner := types.Identity{UserID: "dr_smith", Role: "doctor", Department: "cardiology", Organization: "Hospital A"}

	env, protectEv, err := svc.Protect(plaintext, medicalPolicy(), "", "", "patient_001", owner)
	if err != nil {
		t.Fatalf("protect: %v", err)
	}
	if protectEv.Operation != "protect" {
		t.Fatalf("expected protect evidence, got %s", protectEv.Operation)
	}
	raw, _ := json.Marshal(env)

	// Authorized access → granted, decrypts.
	got, accessEv, err := svc.Access(raw, types.Identity{UserID: "dr_smith", Role: "doctor", Department: "cardiology", Purpose: "treatment"}, types.Context{})
	if err != nil {
		t.Fatalf("authorized access failed: %v", err)
	}
	if string(got) != string(plaintext) {
		t.Fatalf("decrypted mismatch: %q", got)
	}
	if accessEv.Result != "granted" {
		t.Fatalf("expected granted, got %s", accessEv.Result)
	}

	// Unauthorized access → denied, no plaintext, but still audited.
	_, denyEv, err := svc.Access(raw, types.Identity{UserID: "nurse_jane", Role: "nurse", Department: "general", Purpose: "admin"}, types.Context{})
	if err == nil {
		t.Fatal("nurse access should be denied")
	}
	if _, ok := err.(*ErrPolicyViolation); !ok {
		t.Fatalf("expected ErrPolicyViolation, got %T", err)
	}
	if denyEv.Result != "denied" {
		t.Fatalf("expected denied evidence, got %s", denyEv.Result)
	}

	// Verify the whole chain and confirm the denied attempt is recorded.
	entries, total, chainOK, err := svc.EvidenceLog(audit.Filter{}, 1, 50)
	if err != nil {
		t.Fatal(err)
	}
	if !chainOK {
		t.Fatal("evidence chain must verify")
	}
	if total != 3 { // protect + granted access + denied access
		t.Fatalf("expected 3 evidence entries, got %d", total)
	}
	res := svc.VerifyEvidence(entries[1], true)
	if !res.Verified {
		t.Fatalf("granted access evidence must verify: %s", res.Detail)
	}
}

func TestTamperedProtectedDataRejected(t *testing.T) {
	svc := newService()
	owner := types.Identity{UserID: "dr_smith", Role: "doctor", Department: "cardiology"}
	env, _, err := svc.Protect([]byte("secret"), medicalPolicy(), "", "", "r1", owner)
	if err != nil {
		t.Fatal(err)
	}
	// Flip a byte in the ciphertext (still valid base64 length by replacing char).
	if len(env.Ciphertext) > 0 {
		if env.Ciphertext[0] == 'A' {
			env.Ciphertext = "B" + env.Ciphertext[1:]
		} else {
			env.Ciphertext = "A" + env.Ciphertext[1:]
		}
	}
	raw, _ := json.Marshal(env)
	_, _, err = svc.Access(raw, types.Identity{Role: "doctor", Department: "cardiology", Purpose: "treatment"}, types.Context{})
	if err == nil {
		t.Fatal("tampered ciphertext must be rejected")
	}
}
