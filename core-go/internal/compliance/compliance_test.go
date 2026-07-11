package compliance

import (
	"testing"

	"github.com/privyq/privyq/core-go/pkg/types"
)

func ev(op, result, purpose string) types.Evidence {
	return types.Evidence{
		Operation: op, Result: result,
		Actor:  types.Identity{Role: "doctor", Purpose: purpose},
		Policy: types.Policy{Conditions: []types.Condition{{Type: "role", Operator: "equals", Values: []string{"doctor"}}}},
	}
}

func TestGenerateGDPR(t *testing.T) {
	entries := []types.Evidence{
		ev("protect", "granted", "treatment"),
		ev("access", "granted", "treatment"),
		ev("access", "denied", "treatment"),
	}
	r := Generate(GDPR, entries, true, "2026-07-11T00:00:00Z")
	if r.Framework != GDPR || r.TotalEvents != 3 || r.Granted != 2 || r.Denied != 1 {
		t.Fatalf("counts wrong: %+v", r)
	}
	if r.ByPurpose["treatment"] != 3 {
		t.Fatalf("purpose breakdown wrong: %+v", r.ByPurpose)
	}
	// With a verified chain, policy-governed access, and purposes present, controls pass.
	for _, c := range r.Controls {
		if !c.Satisfied {
			t.Fatalf("expected control %q satisfied, basis=%q", c.ID, c.Basis)
		}
	}
}

func TestPurposeLimitationFailsWithoutPurpose(t *testing.T) {
	// An access with no purpose weakens GDPR purpose limitation.
	entries := []types.Evidence{ev("access", "granted", "")}
	r := Generate(GDPR, entries, true, "t")
	var found bool
	for _, c := range r.Controls {
		if c.ID == "gdpr-5-1-b" {
			found = true
			if c.Satisfied {
				t.Fatal("purpose limitation should NOT be satisfied when a purpose is missing")
			}
		}
	}
	if !found {
		t.Fatal("gdpr purpose-limitation control missing")
	}
}

func TestAuditControlNeedsVerifiedChain(t *testing.T) {
	entries := []types.Evidence{ev("access", "granted", "treatment")}
	r := Generate(HIPAA, entries, false, "t") // chain NOT verified
	for _, c := range r.Controls {
		if c.ID == "hipaa-164-312-b" && c.Satisfied {
			t.Fatal("audit control must not be satisfied when the chain does not verify")
		}
	}
}

func TestFrameworksAndUnknown(t *testing.T) {
	for _, fw := range []Framework{GDPR, HIPAA, SOC2, Framework("OTHER")} {
		r := Generate(fw, []types.Evidence{ev("access", "granted", "x")}, true, "t")
		if len(r.Controls) == 0 {
			t.Fatalf("%s should yield controls", fw)
		}
	}
}
