package policies

import (
	"fmt"
	"strings"
	"time"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// Evaluate keeps the v1 entrypoint: it returns a PolicyEvaluation (granted/denied
// with a reason and per-condition breakdown). It now delegates to Decide so v1 and
// v2 share one code path.
func Evaluate(policy types.Policy, identity types.Identity, ctx types.Context) types.PolicyEvaluation {
	return Decide(policy, identity, ctx).AsEvaluation()
}

// Decide is the v2 decision entrypoint (v2 blueprint §6). It applies deny-override,
// evaluates the allow rule (all | any | custom), collects obligations on grant, and
// returns a self-explaining Decision naming which conditions matched and failed.
func Decide(policy types.Policy, identity types.Identity, ctx types.Context) types.Decision {
	now := time.Now().UTC()
	if ctx.Timestamp != "" {
		if t, err := time.Parse(time.RFC3339, ctx.Timestamp); err == nil {
			now = t
		}
	}
	ec := evalContext{now: now}

	d := types.Decision{
		PolicyID:    policy.PolicyID,
		EvaluatedAt: now.Format(time.RFC3339),
		Matched:     []string{},
		Failed:      []string{},
	}

	// 1. Deny rules override everything. Any deny condition that matches denies.
	for _, cond := range policy.DenyConditions {
		r := evaluateOne(cond, identity, ec)
		d.EvaluatedConditions = append(d.EvaluatedConditions, r)
		if r.Result {
			d.Allowed = false
			d.Failed = append(d.Failed, cond.Type)
			d.Reason = fmt.Sprintf("Denied by rule: %s matched (%s, got %q)", cond.Type, r.Expected, r.Actual)
			return d
		}
	}

	// 2. Allow rule.
	results := make([]types.ConditionResult, 0, len(policy.Conditions))
	for _, cond := range policy.Conditions {
		r := evaluateOne(cond, identity, ec)
		results = append(results, r)
		d.EvaluatedConditions = append(d.EvaluatedConditions, r)
		if r.Result {
			d.Matched = append(d.Matched, cond.Type)
		} else {
			d.Failed = append(d.Failed, cond.Type)
		}
	}

	combination := policy.Combination
	if combination == "" {
		combination = "all"
	}

	var granted bool
	switch combination {
	case "custom":
		if strings.TrimSpace(policy.CustomLogic) == "" {
			granted, d.Reason = combineAllAny("all", results) // no expression => behave like "all"
		} else {
			ok, err := evalCustomLogic(policy.CustomLogic, buildVars(identity, ec))
			switch {
			case err != nil:
				granted, d.Reason = false, fmt.Sprintf("Custom policy expression error: %v", err)
			case ok:
				granted, d.Reason = true, "Custom policy expression satisfied"
			default:
				granted, d.Reason = false, "Custom policy expression not satisfied"
			}
		}
	case "all", "any":
		granted, d.Reason = combineAllAny(combination, results)
	default:
		granted, d.Reason = false, fmt.Sprintf("unknown combination mode %q", combination)
	}

	d.Allowed = granted
	if granted {
		d.Obligations = policy.Obligations
	}
	return d
}

func evaluateOne(cond types.Condition, id types.Identity, ec evalContext) types.ConditionResult {
	ext := resolveExtractor(cond.Type)
	actual := ext.get(id, ec)
	pass, err := applyOperator(cond, actual, ext.kind)
	if err != nil {
		pass = false
	}
	if cond.Negate {
		pass = !pass
	}
	return types.ConditionResult{
		Type:     cond.Type,
		Expected: fmt.Sprintf("%s %s", cond.Operator, strings.Join(cond.Values, "|")),
		Actual:   actual,
		Result:   pass,
	}
}

// combineAllAny folds condition results for the built-in "all" / "any" modes and
// produces the overall grant plus an explanatory reason.
func combineAllAny(mode string, results []types.ConditionResult) (bool, string) {
	if mode == "any" {
		for _, r := range results {
			if r.Result {
				return true, "At least one condition satisfied"
			}
		}
		if len(results) == 0 {
			return false, "No conditions to satisfy"
		}
		return false, "No condition satisfied"
	}
	// "all"
	for _, r := range results {
		if !r.Result {
			return false, fmt.Sprintf("%s condition not met (needed %s, got %q)", r.Type, r.Expected, r.Actual)
		}
	}
	return true, "All conditions satisfied"
}

// buildVars flattens the requester's identity + environment into the variable map
// the custom_logic expression engine reads. Named subject fields take precedence
// over free-form attributes of the same key.
func buildVars(id types.Identity, ec evalContext) map[string]string {
	v := make(map[string]string, len(id.Attributes)+8)
	for k, val := range id.Attributes {
		v[k] = val
	}
	setIf := func(k, val string) {
		if val != "" {
			v[k] = val
		}
	}
	setIf("role", id.Role)
	setIf("department", id.Department)
	setIf("purpose", id.Purpose)
	setIf("organization", id.Organization)
	setIf("classification", id.Classification)
	setIf("jurisdiction", id.Jurisdiction)
	setIf("user_id", id.UserID)
	v["now"] = ec.now.Format(time.RFC3339)
	v["time_of_day"] = ec.now.Format("15:04")
	return v
}
