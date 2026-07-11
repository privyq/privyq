package grpc

import (
	"context"
	"testing"

	"github.com/privyq/privyq/core-go/pkg/pb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestKeyRotateRevokeHandlers(t *testing.T) {
	s := newTestServer()
	ctx := context.Background()

	gen, err := s.GenerateKey(ctx, &pb.GenerateKeyRequest{Type: "encryption", Owner: "dr"})
	if err != nil {
		t.Fatal(err)
	}
	rot, err := s.RotateKey(ctx, &pb.RotateKeyRequest{KeyId: gen.Key.KeyId, GracePeriod: "24h"})
	if err != nil {
		t.Fatal(err)
	}
	if rot.NewKeyId == "" || rot.NewKeyId == gen.Key.KeyId {
		t.Fatal("rotate should return a new key id")
	}
	rev, err := s.RevokeKey(ctx, &pb.RevokeKeyRequest{KeyId: rot.NewKeyId, Reason: "compromise"})
	if err != nil {
		t.Fatal(err)
	}
	if rev.RevokedAt == "" {
		t.Fatal("revoke should set revoked_at")
	}
	// Rotating a missing key -> NotFound.
	if _, err := s.RotateKey(ctx, &pb.RotateKeyRequest{KeyId: "missing"}); status.Code(err) != codes.NotFound {
		t.Fatalf("expected NotFound, got %v", err)
	}
}

func TestGenerateAndVerifyEvidenceHandlers(t *testing.T) {
	s := newTestServer()
	ctx := context.Background()
	gen, err := s.GenerateEvidence(ctx, &pb.GenerateEvidenceRequest{
		Actor:      &pb.Identity{UserId: "auditor", Role: "admin"},
		ResourceId: "r1", ResourceHash: "h", Operation: "access",
		PolicyEvaluation: &pb.PolicyEvaluation{Decision: "granted", Reason: "ok"},
	})
	if err != nil {
		t.Fatal(err)
	}
	ver, err := s.VerifyEvidence(ctx, &pb.VerifyEvidenceRequest{Evidence: gen.Evidence, ReevaluatePolicy: true})
	if err != nil {
		t.Fatal(err)
	}
	if !ver.Verified {
		t.Fatalf("generated evidence should verify: %s", ver.Detail)
	}
}

func TestGetPublicKeyHandler(t *testing.T) {
	s := newTestServer()
	ctx := context.Background()
	gen, _ := s.GenerateKey(ctx, &pb.GenerateKeyRequest{Type: "signing", Owner: "sys"})
	got, err := s.GetPublicKey(ctx, &pb.GetPublicKeyRequest{KeyId: gen.Key.KeyId})
	if err != nil {
		t.Fatal(err)
	}
	if got.Key.PublicKey == "" || got.Key.Type != "signing" {
		t.Fatalf("unexpected key info: %+v", got.Key)
	}
}

func TestCheckHandler(t *testing.T) {
	s := newTestServer()
	ctx := context.Background()

	// Protect data with a doctor-only policy, then Check against it.
	prot, err := s.Protect(ctx, &pb.ProtectRequest{
		Plaintext: []byte("record"),
		Policy: &pb.Policy{Version: "2.0", Combination: "all",
			Conditions: []*pb.Condition{{Type: "role", Operator: "equals", Values: []string{"doctor"}}}},
		Actor: &pb.Identity{UserId: "sys"},
	})
	if err != nil {
		t.Fatal(err)
	}

	// A doctor is allowed.
	ok, err := s.Check(ctx, &pb.CheckRequest{ProtectedData: prot.ProtectedData, Identity: &pb.Identity{Role: "doctor"}})
	if err != nil {
		t.Fatal(err)
	}
	if !ok.Decision.Allowed {
		t.Fatalf("doctor should be allowed: %s", ok.Decision.Reason)
	}

	// A nurse is denied, with a reason and a failed condition, and no data revealed.
	deny, err := s.Check(ctx, &pb.CheckRequest{ProtectedData: prot.ProtectedData, Identity: &pb.Identity{Role: "nurse"}, EmitEvidence: true})
	if err != nil {
		t.Fatal(err)
	}
	if deny.Decision.Allowed {
		t.Fatal("nurse should be denied")
	}
	if deny.Decision.Reason == "" || len(deny.Decision.Failed) == 0 {
		t.Fatalf("denied decision should explain itself: %+v", deny.Decision)
	}
	if deny.Evidence == nil || deny.Evidence.EvidenceId == "" {
		t.Fatal("emit_evidence should return a signed evidence entry for the denial")
	}

	// An explicit policy with obligations (no protected data): obligations flow through on grant.
	grant, err := s.Check(ctx, &pb.CheckRequest{
		Policy: &pb.Policy{Combination: "all", PolicyId: "p-obl",
			Conditions:  []*pb.Condition{{Type: "role", Operator: "equals", Values: []string{"researcher"}}},
			Obligations: []string{"mask:patient_name"}},
		Identity: &pb.Identity{Role: "researcher"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !grant.Decision.Allowed || len(grant.Decision.Obligations) != 1 || grant.Decision.PolicyId != "p-obl" {
		t.Fatalf("expected allowed with obligation and policy id: %+v", grant.Decision)
	}
}

func TestConvertRoundTripThroughProtect(t *testing.T) {
	// Drives policy/identity/evidence converters in both directions.
	s := newTestServer()
	ctx := context.Background()
	prot, err := s.Protect(ctx, &pb.ProtectRequest{
		Plaintext: []byte("x"),
		Policy: &pb.Policy{Version: "1.0", Combination: "any", CustomLogic: "",
			Conditions: []*pb.Condition{{Type: "role", Operator: "equals", Values: []string{"doctor"}, Negate: false}},
			Metadata:   map[string]string{"desc": "test"}},
		Actor: &pb.Identity{UserId: "u", Role: "doctor", Attributes: map[string]string{"location": "hq"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if prot.Evidence.Policy.Combination != "any" {
		t.Fatalf("combination not round-tripped: %s", prot.Evidence.Policy.Combination)
	}
}
