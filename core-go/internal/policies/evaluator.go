package policies

import (
	"fmt"
	"strings"
	"time"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// Evaluate runs the policy against identity+context and returns a decision with
// a reason and a per-condition breakdown (ARCH §14.1). The request time is
// taken from ctx.Timestamp when present, otherwise the engine's clock.
func Evaluate(policy types.Policy, identity types.Identity, ctx types.Context) types.PolicyEvaluation {
	now := time.Now().UTC()
	if ctx.Timestamp != "" {
		if t, err := time.Parse(time.RFC3339, ctx.Timestamp); err == nil {
			now = t
		}
	}
	ec := evalContext{now: now}

	results := make([]types.ConditionResult, 0, len(policy.Conditions))
	for _, cond := range policy.Conditions {
		results = append(results, evaluateOne(cond, identity, ec))
	}

	combination := policy.Combination
	if combination == "" {
		combination = "all"
	}
	granted, reason := combine(combination, results)

	decision := "denied"
	if granted {
		decision = "granted"
	}
	return types.PolicyEvaluation{
		Decision:            decision,
		Reason:              reason,
		EvaluatedConditions: results,
	}
}

func evaluateOne(cond types.Condition, id types.Identity, ec evalContext) types.ConditionResult {
	ext, ok := extractors[cond.Type]
	if !ok {
		return types.ConditionResult{
			Type: cond.Type, Expected: strings.Join(cond.Values, ","),
			Actual: "", Result: false,
		}
	}
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

// combine folds the condition results according to the combination mode and
// produces the overall decision plus an explanatory reason.
func combine(mode string, results []types.ConditionResult) (bool, string) {
	switch mode {
	case "any":
		for _, r := range results {
			if r.Result {
				return true, "At least one condition satisfied"
			}
		}
		return false, "No condition satisfied"
	case "all", "custom": // custom logic falls back to "all" until an expression engine is added
		for _, r := range results {
			if !r.Result {
				return false, fmt.Sprintf("%s condition failed (expected %s, got %q)", r.Type, r.Expected, r.Actual)
			}
		}
		return true, "All conditions satisfied"
	default:
		return false, fmt.Sprintf("unknown combination mode %q", mode)
	}
}
