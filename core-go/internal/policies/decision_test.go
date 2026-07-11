package policies

import (
	"testing"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// id builds an Identity with the given role and free-form attributes.
func id(role string, attrs map[string]string) types.Identity {
	return types.Identity{Role: role, Attributes: attrs}
}

// ── Generic attribute conditions + numeric operators (v2 §6.1) ────────────────

func TestGenericAttributeNumericOperators(t *testing.T) {
	tests := []struct {
		name    string
		op      string
		vals    []string
		actual  string
		allowed bool
	}{
		{"gte pass", "gte", []string{"1000000"}, "1000000", true},
		{"gte fail", "gte", []string{"1000000"}, "999999", false},
		{"gt pass", "gt", []string{"0"}, "5", true},
		{"gt fail", "gt", []string{"0"}, "0", false},
		{"lt pass", "lt", []string{"100"}, "50", true},
		{"lte pass", "lte", []string{"100"}, "100", true},
		{"between pass", "between", []string{"10", "20"}, "15", true},
		{"between fail", "between", []string{"10", "20"}, "25", false},
		{"non-numeric attr fails", "gte", []string{"10"}, "abc", false},
		{"missing attr fails", "gte", []string{"10"}, "", false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			p := types.Policy{Combination: "all", Conditions: []types.Condition{
				cond("approval_limit", tc.op, tc.vals...),
			}}
			d := Decide(p, id("manager", map[string]string{"approval_limit": tc.actual}), types.Context{})
			if d.Allowed != tc.allowed {
				t.Fatalf("allowed=%v, want %v (reason: %s)", d.Allowed, tc.allowed, d.Reason)
			}
		})
	}
}

// ── Deny overrides allow (v2 §6.3) ────────────────────────────────────────────

func TestDenyOverridesAllow(t *testing.T) {
	p := types.Policy{
		Combination: "all",
		Conditions:  []types.Condition{cond("role", "equals", "doctor")},
		DenyConditions: []types.Condition{
			cond("jurisdiction", "not_in", "NG", "GH"),
		},
	}
	// Doctor, but from a denied jurisdiction → denied despite matching allow.
	d := Decide(p, types.Identity{Role: "doctor", Jurisdiction: "US"}, types.Context{})
	if d.Allowed {
		t.Fatalf("expected deny-override, got allowed (reason: %s)", d.Reason)
	}
	// Doctor from an allowed jurisdiction → allowed.
	d = Decide(p, types.Identity{Role: "doctor", Jurisdiction: "NG"}, types.Context{})
	if !d.Allowed {
		t.Fatalf("expected allow, got denied (reason: %s)", d.Reason)
	}
}

// ── Obligations returned only on grant (v2 §6.4) ──────────────────────────────

func TestObligationsOnGrantOnly(t *testing.T) {
	p := types.Policy{
		Combination: "all",
		Conditions:  []types.Condition{cond("role", "equals", "researcher")},
		Obligations: []string{"mask:patient_name", "log"},
	}
	granted := Decide(p, id("researcher", nil), types.Context{})
	if !granted.Allowed || len(granted.Obligations) != 2 {
		t.Fatalf("granted should carry obligations, got allowed=%v obligations=%v", granted.Allowed, granted.Obligations)
	}
	denied := Decide(p, id("nurse", nil), types.Context{})
	if denied.Allowed || len(denied.Obligations) != 0 {
		t.Fatalf("denied should carry no obligations, got allowed=%v obligations=%v", denied.Allowed, denied.Obligations)
	}
}

// ── Matched / failed breakdown (v2 §6.2) ──────────────────────────────────────

func TestDecisionMatchedAndFailed(t *testing.T) {
	p := types.Policy{Combination: "all", Conditions: []types.Condition{
		cond("role", "equals", "doctor"),
		cond("department", "equals", "cardiology"),
	}}
	d := Decide(p, types.Identity{Role: "doctor", Department: "oncology"}, types.Context{})
	if d.Allowed {
		t.Fatal("expected denied")
	}
	if len(d.Matched) != 1 || d.Matched[0] != "role" {
		t.Fatalf("matched=%v, want [role]", d.Matched)
	}
	if len(d.Failed) != 1 || d.Failed[0] != "department" {
		t.Fatalf("failed=%v, want [department]", d.Failed)
	}
	if d.EvaluatedAt == "" {
		t.Fatal("EvaluatedAt should be set")
	}
}

// ── Custom-logic expression engine (v2 §6.3, gap B7) ──────────────────────────

func TestCustomLogicBankingBreakGlass(t *testing.T) {
	p := types.Policy{
		Combination: "custom",
		CustomLogic: `role == "manager" and (amount <= approval_limit or emergency)`,
	}
	cases := []struct {
		name    string
		attrs   map[string]string
		allowed bool
	}{
		{"within limit", map[string]string{"amount": "500000", "approval_limit": "1000000"}, true},
		{"over limit, no emergency", map[string]string{"amount": "2000000", "approval_limit": "1000000"}, false},
		{"over limit, break-glass", map[string]string{"amount": "2000000", "approval_limit": "1000000", "emergency": "true"}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			d := Decide(p, id("manager", tc.attrs), types.Context{})
			if d.Allowed != tc.allowed {
				t.Fatalf("allowed=%v, want %v (reason: %s)", d.Allowed, tc.allowed, d.Reason)
			}
		})
	}
	// A non-manager is denied regardless.
	d := Decide(p, id("clerk", map[string]string{"amount": "1", "approval_limit": "100"}), types.Context{})
	if d.Allowed {
		t.Fatal("clerk should be denied by the manager clause")
	}
}

func TestCustomLogicAISubscription(t *testing.T) {
	p := types.Policy{Combination: "custom", CustomLogic: `subscription == "pro" and credits > 0`}
	if !Decide(p, id("svc", map[string]string{"subscription": "pro", "credits": "5"}), types.Context{}).Allowed {
		t.Fatal("pro with credits should be allowed")
	}
	if Decide(p, id("svc", map[string]string{"subscription": "pro", "credits": "0"}), types.Context{}).Allowed {
		t.Fatal("pro with zero credits should be denied")
	}
	if Decide(p, id("svc", map[string]string{"subscription": "free", "credits": "5"}), types.Context{}).Allowed {
		t.Fatal("free tier should be denied")
	}
}

func TestCustomLogicPrecedenceAndNot(t *testing.T) {
	// not binds tighter than and; and tighter than or.
	p := types.Policy{Combination: "custom", CustomLogic: `not blocked and (role == "admin" or role == "owner")`}
	if !Decide(p, id("admin", map[string]string{"blocked": "false"}), types.Context{}).Allowed {
		t.Fatal("admin not blocked should be allowed")
	}
	if Decide(p, id("admin", map[string]string{"blocked": "true"}), types.Context{}).Allowed {
		t.Fatal("blocked admin should be denied")
	}
	if Decide(p, id("guest", map[string]string{"blocked": "false"}), types.Context{}).Allowed {
		t.Fatal("guest should be denied")
	}
}

func TestCustomLogicErrorFailsClosed(t *testing.T) {
	p := types.Policy{Combination: "custom", CustomLogic: `role == = "x"`} // malformed
	d := Decide(p, id("admin", nil), types.Context{})
	if d.Allowed {
		t.Fatal("a malformed expression must fail closed (deny)")
	}
}

func TestCustomLogicEmptyBehavesLikeAll(t *testing.T) {
	p := types.Policy{
		Combination: "custom", // no CustomLogic provided
		Conditions:  []types.Condition{cond("role", "equals", "doctor")},
	}
	if !Decide(p, id("doctor", nil), types.Context{}).Allowed {
		t.Fatal("empty custom logic should behave like all -> doctor allowed")
	}
	if Decide(p, id("nurse", nil), types.Context{}).Allowed {
		t.Fatal("empty custom logic should behave like all -> nurse denied")
	}
}

// ── Direct expression-engine unit tests ───────────────────────────────────────

func TestEvalCustomLogicUnit(t *testing.T) {
	vars := map[string]string{"a": "3", "b": "5", "name": "kyber", "flag": "yes"}
	tests := []struct {
		expr string
		want bool
	}{
		{`a < b`, true},
		{`a > b`, false},
		{`a == 3`, true},
		{`b >= 5 and a <= 3`, true},
		{`name == "kyber"`, true},
		{`name == "dilithium"`, false},
		{`name != "x"`, true},
		{`flag`, true},               // "yes" is truthy
		{`missing`, false},           // missing var is falsy
		{`not missing`, true},        //
		{`(a < b) or (a > b)`, true}, //
		{`a < b and (name == "x" or flag)`, true},
	}
	for _, tc := range tests {
		got, err := evalCustomLogic(tc.expr, vars)
		if err != nil {
			t.Fatalf("%q: unexpected error %v", tc.expr, err)
		}
		if got != tc.want {
			t.Fatalf("%q = %v, want %v", tc.expr, got, tc.want)
		}
	}
}

func TestEvalCustomLogicErrors(t *testing.T) {
	bad := []string{
		`a < `,           // missing operand
		`a <= "x"`,       // non-numeric on ordered comparison
		`(a < b`,         // unbalanced paren
		`a @ b`,          // bad char
		`"unterminated`,  // bad string
		`a < b extra`,    // trailing token
		`1.2.3`,          // malformed number literal
		``,               // empty expression
		`not`,            // not with no operand
		`true and 1.2.3`, // error propagates through the right side of 'and'
		`false or 1.2.3`, // error propagates through the right side of 'or'
	}
	for _, expr := range bad {
		if _, err := evalCustomLogic(expr, map[string]string{"a": "1", "b": "2"}); err == nil {
			t.Fatalf("%q: expected an error, got none", expr)
		}
	}
}

// Covers the value helpers: truthy for numbers/bools, and asString/asNumber on the
// mixed-type equality paths.
func TestEvalCustomLogicValueForms(t *testing.T) {
	tests := []struct {
		expr string
		want bool
	}{
		{`5`, true},              // bare non-zero number is truthy
		{`0`, false},             // zero is falsy
		{`true`, true},           // bool literal
		{`false`, false},         // bool literal
		{`5 == "abc"`, false},    // number vs non-numeric string -> string compare
		{`true == "true"`, true}, // bool vs string -> string compare
		{`5 == "5"`, true},       // number vs numeric string -> numeric compare
	}
	for _, tc := range tests {
		got, err := evalCustomLogic(tc.expr, nil)
		if err != nil {
			t.Fatalf("%q: unexpected error %v", tc.expr, err)
		}
		if got != tc.want {
			t.Fatalf("%q = %v, want %v", tc.expr, got, tc.want)
		}
	}
}

// "any" combination edge cases and numeric-operator value errors (fail closed).
func TestCombineAnyEdgesAndNumericErrors(t *testing.T) {
	// "any" with no conditions.
	if Decide(types.Policy{Combination: "any"}, id("x", nil), types.Context{}).Allowed {
		t.Fatal("any over zero conditions should deny")
	}
	// "any" with all conditions failing.
	pAny := types.Policy{Combination: "any", Conditions: []types.Condition{cond("role", "equals", "doctor")}}
	if Decide(pAny, id("nurse", nil), types.Context{}).Allowed {
		t.Fatal("any with all-failing conditions should deny")
	}
	// Numeric operator with a non-numeric policy value -> fails closed.
	pBadVal := types.Policy{Combination: "all", Conditions: []types.Condition{cond("approval_limit", "gte", "not-a-number")}}
	if Decide(pBadVal, id("m", map[string]string{"approval_limit": "5"}), types.Context{}).Allowed {
		t.Fatal("gte with non-numeric bound should deny")
	}
	// between with a missing second bound -> fails closed.
	pBadBetween := types.Policy{Combination: "all", Conditions: []types.Condition{cond("credits", "between", "10")}}
	if Decide(pBadBetween, id("m", map[string]string{"credits": "15"}), types.Context{}).Allowed {
		t.Fatal("between with one bound should deny")
	}
}

// Temporal-condition error branches all fail closed.
func TestTimeOperatorErrorsFailClosed(t *testing.T) {
	cases := []types.Condition{
		cond("expiry", "before", "not-a-timestamp"),        // unparseable policy value
		cond("expiry", "between", "2020-01-01T00:00:00Z"),  // missing upper bound
		cond("time_of_day", "before", "99:99"),             // unparseable clock value
		cond("expiry", "sideways", "2020-01-01T00:00:00Z"), // unknown time operator
	}
	for _, c := range cases {
		p := types.Policy{Combination: "all", Conditions: []types.Condition{c}}
		if Decide(p, id("x", nil), types.Context{Timestamp: "2026-07-11T12:00:00Z"}).Allowed {
			t.Fatalf("time condition %+v should fail closed", c)
		}
	}
}
