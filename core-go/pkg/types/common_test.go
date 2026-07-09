package types

import "testing"

func TestGranted(t *testing.T) {
	if !(PolicyEvaluation{Decision: "granted"}).Granted() {
		t.Fatal("granted decision should report Granted() true")
	}
	if (PolicyEvaluation{Decision: "denied"}).Granted() {
		t.Fatal("denied decision should report Granted() false")
	}
}

func TestMarshalPolicy(t *testing.T) {
	p := Policy{Version: "1.0", Combination: "all", Conditions: []Condition{
		{Type: "role", Operator: "equals", Values: []string{"doctor"}},
	}}
	b, err := MarshalPolicy(p)
	if err != nil {
		t.Fatal(err)
	}
	if len(b) == 0 {
		t.Fatal("marshaled policy should not be empty")
	}
}
