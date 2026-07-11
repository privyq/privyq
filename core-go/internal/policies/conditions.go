// Package policies is the Policy Decision Engine (ARCH §14). It evaluates a
// policy's conditions against a requester identity and context and returns a
// grant/deny decision with a human-readable reason.
//
// The engine is extensible in two dimensions (BP App D):
//   - condition types    — what attribute is being checked (registered in extractors)
//   - operators          — how the value is compared (registered in operators)
//
// New condition types can be added without changing the evaluator (ARCH §25.1).
package policies

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// attrKind classifies how a condition's actual value is sourced and compared.
type attrKind int

const (
	kindString    attrKind = iota // compared as strings
	kindTime                      // "actual" is the request time; value is an RFC3339 timestamp
	kindTimeOfDay                 // "actual" is the request clock time; value is "HH:MM"
)

// extractor returns the requester-side value for a condition type plus its kind.
type extractor struct {
	kind attrKind
	get  func(id types.Identity, ctx evalContext) string
}

// extractors is the registry of supported condition types (BP App D.2).
var extractors = map[string]extractor{
	"role":           {kindString, func(id types.Identity, _ evalContext) string { return id.Role }},
	"department":     {kindString, func(id types.Identity, _ evalContext) string { return id.Department }},
	"purpose":        {kindString, func(id types.Identity, _ evalContext) string { return id.Purpose }},
	"classification": {kindString, func(id types.Identity, _ evalContext) string { return id.Classification }},
	"jurisdiction":   {kindString, func(id types.Identity, _ evalContext) string { return id.Jurisdiction }},
	"organization":   {kindString, func(id types.Identity, _ evalContext) string { return id.Organization }},
	"location":       {kindString, func(id types.Identity, _ evalContext) string { return id.Attributes["location"] }},
	"device_type":    {kindString, func(id types.Identity, _ evalContext) string { return id.Attributes["device_type"] }},
	"delegated_from": {kindString, func(id types.Identity, _ evalContext) string { return id.Attributes["delegated_from"] }},
	"delegation":     {kindString, func(id types.Identity, _ evalContext) string { return id.Attributes["delegation"] }},
	// Temporal conditions compare against the request time.
	"expiry":      {kindTime, func(_ types.Identity, ctx evalContext) string { return ctx.now.Format(time.RFC3339) }},
	"valid_from":  {kindTime, func(_ types.Identity, ctx evalContext) string { return ctx.now.Format(time.RFC3339) }},
	"valid_until": {kindTime, func(_ types.Identity, ctx evalContext) string { return ctx.now.Format(time.RFC3339) }},
	"time_of_day": {kindTimeOfDay, func(_ types.Identity, ctx evalContext) string { return ctx.now.Format("15:04") }},
}

type evalContext struct {
	now time.Time
}

// resolveExtractor returns the registered extractor for a condition type, or a
// generic attribute extractor that reads id.Attributes[type]. This is what makes
// v2 ABAC work: a policy may condition on ANY attribute (approval_limit, shift,
// subscription, credits, hospital, wallet, ...) without registering a new type
// (v2 blueprint §6.1).
func resolveExtractor(condType string) extractor {
	if ext, ok := extractors[condType]; ok {
		return ext
	}
	return extractor{
		kind: kindString,
		get:  func(id types.Identity, _ evalContext) string { return id.Attributes[condType] },
	}
}

// applyOperator compares the requester's actual value against the condition
// using the condition's operator, returning the boolean result. For time kinds,
// actual is the request time and values are the policy's timestamps.
func applyOperator(cond types.Condition, actual string, kind attrKind) (bool, error) {
	op := cond.Operator
	vals := cond.Values
	first := ""
	if len(vals) > 0 {
		first = vals[0]
	}

	switch kind {
	case kindTime, kindTimeOfDay:
		return applyTimeOperator(op, actual, vals, kind)
	}

	// String operators.
	switch op {
	case "equals":
		return actual == first, nil
	case "not_equals":
		return actual != first, nil
	case "in", "one_of":
		return contains(vals, actual), nil
	case "not_in":
		return !contains(vals, actual), nil
	case "contains":
		return strings.Contains(actual, first), nil
	case "starts_with":
		return strings.HasPrefix(actual, first), nil
	case "ends_with":
		return strings.HasSuffix(actual, first), nil
	case "gt", "gte", "lt", "lte", "between":
		// Numeric comparison for generic attributes (approval_limit, credits, ...).
		return applyNumericOperator(op, actual, vals)
	default:
		return false, fmt.Errorf("operator %q not valid for a string condition", op)
	}
}

// applyNumericOperator compares the requester's actual value against the policy
// values numerically. Non-numeric operands make the condition fail (not error).
func applyNumericOperator(op, actual string, vals []string) (bool, error) {
	a, err := strconv.ParseFloat(strings.TrimSpace(actual), 64)
	if err != nil {
		return false, nil // a missing/non-numeric attribute simply doesn't satisfy the bound
	}
	num := func(i int) (float64, bool) {
		if i >= len(vals) {
			return 0, false
		}
		v, err := strconv.ParseFloat(strings.TrimSpace(vals[i]), 64)
		return v, err == nil
	}
	switch op {
	case "gt", "gte", "lt", "lte":
		v, ok := num(0)
		if !ok {
			return false, fmt.Errorf("operator %q needs a numeric value", op)
		}
		switch op {
		case "gt":
			return a > v, nil
		case "gte":
			return a >= v, nil
		case "lt":
			return a < v, nil
		default: // lte
			return a <= v, nil
		}
	case "between":
		lo, ok1 := num(0)
		hi, ok2 := num(1)
		if !ok1 || !ok2 {
			return false, fmt.Errorf("operator \"between\" needs two numeric values")
		}
		return a >= lo && a <= hi, nil
	default:
		return false, fmt.Errorf("operator %q not numeric", op)
	}
}

func applyTimeOperator(op, actual string, vals []string, kind attrKind) (bool, error) {
	layout := time.RFC3339
	if kind == kindTimeOfDay {
		layout = "15:04"
	}
	now, err := time.Parse(layout, actual)
	if err != nil {
		return false, fmt.Errorf("bad request time %q: %w", actual, err)
	}
	parseVal := func(i int) (time.Time, error) {
		if i >= len(vals) {
			return time.Time{}, fmt.Errorf("missing value for operator %q", op)
		}
		// Accept date-only "2006-01-02" for convenience on RFC3339 fields.
		if kind == kindTime {
			if t, e := time.Parse(time.RFC3339, vals[i]); e == nil {
				return t, nil
			}
			return time.Parse("2006-01-02", vals[i])
		}
		return time.Parse(layout, vals[i])
	}
	switch op {
	case "before", "lt", "lte":
		v, err := parseVal(0)
		if err != nil {
			return false, err
		}
		return now.Before(v) || (op == "lte" && now.Equal(v)), nil
	case "after", "gt", "gte":
		v, err := parseVal(0)
		if err != nil {
			return false, err
		}
		return now.After(v) || (op == "gte" && now.Equal(v)), nil
	case "between":
		lo, err := parseVal(0)
		if err != nil {
			return false, err
		}
		hi, err := parseVal(1)
		if err != nil {
			return false, err
		}
		return !now.Before(lo) && !now.After(hi), nil
	default:
		return false, fmt.Errorf("operator %q not valid for a time condition", op)
	}
}

func contains(haystack []string, needle string) bool {
	for _, h := range haystack {
		if h == needle {
			return true
		}
	}
	return false
}
