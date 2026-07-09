package core

import (
	"encoding/json"
	"testing"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// Benchmarks for the operations tabulated in BP §19.1 / ARCH §24.3.
// Run: go test ./internal/core -bench . -benchmem -run x

func benchService(b *testing.B) *Service {
	b.Helper()
	return newService()
}

func BenchmarkProtect(b *testing.B) {
	svc := benchService(b)
	owner := types.Identity{UserID: "dr", Role: "doctor", Department: "cardiology"}
	data := []byte("Patient: John Doe. Plan: continue beta-blocker.")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, _, err := svc.Protect(data, medicalPolicy(), "", "", "r", owner); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkAccessGranted(b *testing.B) {
	svc := benchService(b)
	owner := types.Identity{UserID: "dr", Role: "doctor", Department: "cardiology"}
	env, _, _ := svc.Protect([]byte("record"), medicalPolicy(), "", "", "r", owner)
	raw, _ := json.Marshal(env)
	id := types.Identity{Role: "doctor", Department: "cardiology", Purpose: "treatment"}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, _, err := svc.Access(raw, id, types.Context{}); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkVerifyEvidence(b *testing.B) {
	svc := benchService(b)
	owner := types.Identity{UserID: "dr", Role: "doctor", Department: "cardiology"}
	_, ev, _ := svc.Protect([]byte("record"), medicalPolicy(), "", "", "r", owner)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if res := svc.VerifyEvidence(ev, false); !res.SignatureValid {
			b.Fatal("verify failed")
		}
	}
}
