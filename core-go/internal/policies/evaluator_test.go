package policies

import (
	"testing"
	"time"

	"github.com/privyq/privyq/core-go/pkg/types"
)

func cond(t, op string, v ...string) types.Condition {
	return types.Condition{Type: t, Operator: op, Values: v}
}

// The canonical medical policy from BP §25 / App D.4.
func medicalPolicy() types.Policy {
	return types.Policy{
		Version: "1.0", Combination: "all",
		Conditions: []types.Condition{
			cond("role", "equals", "doctor"),
			cond("department", "in", "cardiology", "oncology"),
			cond("purpose", "equals", "treatment"),
			cond("expiry", "before", "2099-12-31T23:59:59Z"),
		},
	}
}

func TestAuthorizedDoctorGranted(t *testing.T) {
	id := types.Identity{Role: "doctor", Department: "cardiology", Purpose: "treatment"}
	got := Evaluate(medicalPolicy(), id, types.Context{})
	if !got.Granted() {
		t.Fatalf("expected granted, got %s: %s", got.Decision, got.Reason)
	}
}

func TestUnauthorizedNurseDenied(t *testing.T) {
	id := types.Identity{Role: "nurse", Department: "general", Purpose: "admin"}
	got := Evaluate(medicalPolicy(), id, types.Context{})
	if got.Granted() {
		t.Fatal("nurse must be denied")
	}
	if got.EvaluatedConditions[0].Result {
		t.Fatal("role condition should have failed")
	}
}

func TestExpiredPolicyDenied(t *testing.T) {
	p := types.Policy{Combination: "all", Conditions: []types.Condition{cond("expiry", "before", "2000-01-01T00:00:00Z")}}
	got := Evaluate(p, types.Identity{Role: "doctor"}, types.Context{Timestamp: time.Now().UTC().Format(time.RFC3339)})
	if got.Granted() {
		t.Fatal("expired policy must deny")
	}
}

func TestCombinationAny(t *testing.T) {
	p := types.Policy{Combination: "any", Conditions: []types.Condition{
		cond("role", "equals", "admin"),
		cond("role", "equals", "doctor"),
	}}
	got := Evaluate(p, types.Identity{Role: "doctor"}, types.Context{})
	if !got.Granted() {
		t.Fatal("any-combination should grant when one matches")
	}
}

func TestOperators(t *testing.T) {
	cases := []struct {
		name string
		c    types.Condition
		id   types.Identity
		want bool
	}{
		{"equals", cond("role", "equals", "doctor"), types.Identity{Role: "doctor"}, true},
		{"not_equals", cond("role", "not_equals", "nurse"), types.Identity{Role: "doctor"}, true},
		{"in", cond("department", "in", "a", "cardiology"), types.Identity{Department: "cardiology"}, true},
		{"not_in", cond("department", "not_in", "a", "b"), types.Identity{Department: "cardiology"}, true},
		{"contains", cond("role", "contains", "doc"), types.Identity{Role: "doctor"}, true},
		{"starts_with", cond("role", "starts_with", "doc"), types.Identity{Role: "doctor"}, true},
		{"ends_with", cond("role", "ends_with", "tor"), types.Identity{Role: "doctor"}, true},
		{"negate", types.Condition{Type: "role", Operator: "equals", Values: []string{"nurse"}, Negate: true}, types.Identity{Role: "doctor"}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := types.Policy{Combination: "all", Conditions: []types.Condition{tc.c}}
			if got := Evaluate(p, tc.id, types.Context{}).Granted(); got != tc.want {
				t.Fatalf("%s: got %v want %v", tc.name, got, tc.want)
			}
		})
	}
}

func TestUnknownConditionTypeDenies(t *testing.T) {
	p := types.Policy{Combination: "all", Conditions: []types.Condition{cond("phase_of_moon", "equals", "full")}}
	if Evaluate(p, types.Identity{}, types.Context{}).Granted() {
		t.Fatal("unknown condition type must fail closed")
	}
}
