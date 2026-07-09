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
