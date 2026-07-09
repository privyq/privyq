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
	default:
		return false, fmt.Errorf("operator %q not valid for a string condition", op)
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
