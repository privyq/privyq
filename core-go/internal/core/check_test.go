package core

import (
	"encoding/json"
	"testing"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// Break-glass: an emergency access is granted (via policy) and distinctly flagged
// in the evidence trail (v2 blueprint §10).
func TestBreakGlassFlaggedInEvidence(t *testing.T) {
	svc := newService()
	policy := types.Policy{Combination: "custom", CustomLogic: `role == "doctor" or emergency`}
	env, _, err := svc.Protect([]byte("x"), policy, "", "", "r_bg", types.Identity{Role: "doctor"})
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(env)

	// A nurse normally denied, but emergency=true satisfies the policy AND flags evidence.
	_, ev, err := svc.Access(raw, types.Identity{Role: "nurse", Attributes: map[string]string{"emergency": "true"}}, types.Context{})
	if err != nil {
		t.Fatalf("break-glass access should be granted: %v", err)
	}
	if ev.Metadata["break_glass"] != "true" {
		t.Fatalf("break-glass access should be flagged, metadata=%+v", ev.Metadata)
	}

	// A normal denied access is not flagged.
	_, ev2, _ := svc.Access(raw, types.Identity{Role: "nurse"}, types.Context{})
	if ev2.Metadata["break_glass"] == "true" {
		t.Fatal("non-emergency access should not be flagged break_glass")
	}
}

func TestCheckDecision(t *testing.T) {
	svc := newService()
	owner := types.Identity{UserID: "sys", Role: "doctor", Department: "cardiology"}
	env, _, err := svc.Protect([]byte("record"), medicalPolicy(), "", "", "patient_1", owner)
	if err != nil {
		t.Fatalf("protect: %v", err)
	}
	raw, _ := json.Marshal(env)

	// Allowed doctor, no evidence emitted.
	doctor := types.Identity{Role: "doctor", Department: "cardiology", Purpose: "treatment"}
	d, ev, err := svc.Check(raw, types.Policy{}, doctor, types.Context{}, false)
	if err != nil {
		t.Fatal(err)
	}
	if !d.Allowed {
		t.Fatalf("doctor should be allowed: %s", d.Reason)
	}
	if ev.EvidenceID != "" {
		t.Fatal("no evidence should be emitted when emitEvidence is false")
	}

	// Denied nurse, with evidence emitted.
	before, _ := svc.Evidence.Count()
	d2, ev2, err := svc.Check(raw, types.Policy{}, types.Identity{Role: "nurse"}, types.Context{}, true)
	if err != nil {
		t.Fatal(err)
	}
	if d2.Allowed || d2.Reason == "" {
		t.Fatalf("nurse should be denied with a reason: %+v", d2)
	}
	if ev2.EvidenceID == "" || ev2.Operation != "check" {
		t.Fatalf("expected a 'check' evidence entry, got %+v", ev2)
	}
	after, _ := svc.Evidence.Count()
	if after != before+1 {
		t.Fatalf("evidence chain should grow by one: %d -> %d", before, after)
	}

	// Explicit policy path (no protected data), with obligations on grant.
	p := types.Policy{Combination: "all", PolicyID: "p1",
		Conditions:  []types.Condition{{Type: "role", Operator: "equals", Values: []string{"researcher"}}},
		Obligations: []string{"mask:name"}}
	d3, _, err := svc.Check(nil, p, types.Identity{Role: "researcher"}, types.Context{}, false)
	if err != nil {
		t.Fatal(err)
	}
	if !d3.Allowed || len(d3.Obligations) != 1 || d3.PolicyID != "p1" {
		t.Fatalf("expected allow with obligation + policy id: %+v", d3)
	}

	// Malformed protected data → error.
	if _, _, err := svc.Check([]byte("{not json"), types.Policy{}, doctor, types.Context{}, false); err == nil {
		t.Fatal("malformed protected data should error")
	}
}
