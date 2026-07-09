package policies

import (
	"testing"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// Exercises every time/temporal operator branch in applyTimeOperator, plus the
// invalid-operator and bad-value error paths (conditions.go).
func TestTimeOperators(t *testing.T) {
	now := "2026-06-15T12:00:00Z"
	cases := []struct {
		name string
		c    types.Condition
		want bool
	}{
		{"before-true", cond("expiry", "before", "2026-12-31T23:59:59Z"), true},
		{"before-false", cond("expiry", "before", "2020-01-01T00:00:00Z"), false},
		{"after-true", cond("valid_from", "after", "2020-01-01T00:00:00Z"), true},
		{"after-false", cond("valid_from", "after", "2030-01-01T00:00:00Z"), false},
		{"between-true", cond("expiry", "between", "2026-01-01T00:00:00Z", "2026-12-31T00:00:00Z"), true},
		{"between-false", cond("expiry", "between", "2027-01-01T00:00:00Z", "2027-12-31T00:00:00Z"), false},
		{"lte-equal", cond("expiry", "lte", "2026-12-31T00:00:00Z"), true},
		{"gte", cond("valid_from", "gte", "2020-01-01T00:00:00Z"), true},
		{"date-only-value", cond("expiry", "before", "2026-12-31"), true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := types.Policy{Combination: "all", Conditions: []types.Condition{tc.c}}
			got := Evaluate(p, types.Identity{}, types.Context{Timestamp: now}).Granted()
			if got != tc.want {
				t.Fatalf("%s: got %v want %v", tc.name, got, tc.want)
			}
		})
	}
}

func TestTimeOfDayBetween(t *testing.T) {
	p := types.Policy{Combination: "all", Conditions: []types.Condition{cond("time_of_day", "between", "09:00", "17:00")}}
	// 12:00 is inside business hours -> granted.
	if !Evaluate(p, types.Identity{}, types.Context{Timestamp: "2026-06-15T12:00:00Z"}).Granted() {
		t.Fatal("noon should be within 09:00-17:00")
	}
	// 20:00 is outside.
	if Evaluate(p, types.Identity{}, types.Context{Timestamp: "2026-06-15T20:00:00Z"}).Granted() {
		t.Fatal("20:00 should be outside business hours")
	}
}

func TestInvalidOperatorAndValueFailClosed(t *testing.T) {
	// A time operator on a string condition, and a bad operator, must fail closed.
	bad := types.Policy{Combination: "all", Conditions: []types.Condition{cond("role", "before", "x")}}
	if Evaluate(bad, types.Identity{Role: "doctor"}, types.Context{}).Granted() {
		t.Fatal("nonsensical operator must deny")
	}
	missing := types.Policy{Combination: "all", Conditions: []types.Condition{{Type: "expiry", Operator: "between", Values: []string{"2026-01-01T00:00:00Z"}}}}
	if Evaluate(missing, types.Identity{}, types.Context{Timestamp: "2026-06-15T12:00:00Z"}).Granted() {
		t.Fatal("between with a missing second value must deny")
	}
}

func TestUnknownCombinationDenies(t *testing.T) {
	p := types.Policy{Combination: "xor", Conditions: []types.Condition{cond("role", "equals", "doctor")}}
	if Evaluate(p, types.Identity{Role: "doctor"}, types.Context{}).Granted() {
		t.Fatal("unknown combination mode must deny")
	}
}

func TestContextTimestampFallbackToNow(t *testing.T) {
	// Empty context timestamp -> engine uses its own clock; an already-expired
	// policy must still deny.
	p := types.Policy{Combination: "all", Conditions: []types.Condition{cond("expiry", "before", "2000-01-01T00:00:00Z")}}
	if Evaluate(p, types.Identity{}, types.Context{}).Granted() {
		t.Fatal("expired policy must deny even without an explicit timestamp")
	}
}
