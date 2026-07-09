package grpc

import (
	"context"
	"testing"

	"github.com/privyq/privyq/core-go/internal/audit"
	"github.com/privyq/privyq/core-go/internal/core"
	"github.com/privyq/privyq/core-go/internal/keymanager"
	"github.com/privyq/privyq/core-go/pkg/pb"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func newTestServer() *Server {
	svc := core.New(keymanager.New(keymanager.NewMemoryStore()), audit.NewMemoryEvidenceStore(), "test")
	return NewServer(svc)
}

func doctorPolicy() *pb.Policy {
	return &pb.Policy{
		Version: "1.0", Combination: "all",
		Conditions: []*pb.Condition{
			{Type: "role", Operator: "equals", Values: []string{"doctor"}},
			{Type: "department", Operator: "in", Values: []string{"cardiology"}},
		},
	}
}

func TestServerProtectAccessFlow(t *testing.T) {
	s := newTestServer()
	ctx := context.Background()

	prot, err := s.Protect(ctx, &pb.ProtectRequest{
		Plaintext: []byte("ECG normal"),
		Policy:    doctorPolicy(),
		Actor:     &pb.Identity{UserId: "dr_smith", Role: "doctor", Department: "cardiology"},
	})
	if err != nil {
		t.Fatalf("protect: %v", err)
	}
	if prot.Evidence == nil || prot.PolicyHash == "" {
		t.Fatal("protect response missing evidence/policy hash")
	}

	// Authorized.
	acc, err := s.Access(ctx, &pb.AccessRequest{
		ProtectedData: prot.ProtectedData,
		Identity:      &pb.Identity{UserId: "dr_smith", Role: "doctor", Department: "cardiology"},
	})
	if err != nil {
		t.Fatalf("authorized access: %v", err)
	}
	if string(acc.Data) != "ECG normal" {
		t.Fatalf("bad plaintext: %q", acc.Data)
	}

	// Denied → PermissionDenied gRPC code (ARCH §21.3).
	_, err = s.Access(ctx, &pb.AccessRequest{
		ProtectedData: prot.ProtectedData,
		Identity:      &pb.Identity{UserId: "nurse", Role: "nurse", Department: "general"},
	})
	if status.Code(err) != codes.PermissionDenied {
		t.Fatalf("expected PermissionDenied, got %v", err)
	}

	// Evidence log verifies.
	log, err := s.GetEvidenceLog(ctx, &pb.GetEvidenceLogRequest{Page: 1, PageSize: 10})
	if err != nil {
		t.Fatal(err)
	}
	if !log.ChainVerified || log.Total != 3 {
		t.Fatalf("expected 3 verified entries, got total=%d verified=%v", log.Total, log.ChainVerified)
	}
}

func TestServerKeyLifecycleAndSign(t *testing.T) {
	s := newTestServer()
	ctx := context.Background()

	gen, err := s.GenerateKey(ctx, &pb.GenerateKeyRequest{Algorithm: "dilithium_3", Type: "signing", Owner: "sys"})
	if err != nil {
		t.Fatal(err)
	}
	sig, err := s.Sign(ctx, &pb.SignRequest{Message: []byte("hello"), KeyId: gen.Key.KeyId})
	if err != nil {
		t.Fatal(err)
	}
	ver, err := s.Verify(ctx, &pb.VerifyRequest{Message: []byte("hello"), Signature: sig.Signature, PublicKeyId: gen.Key.KeyId})
	if err != nil || !ver.Valid {
		t.Fatalf("verify failed: %v valid=%v", err, ver.GetValid())
	}

	if _, err := s.GetPublicKey(ctx, &pb.GetPublicKeyRequest{KeyId: "nope"}); status.Code(err) != codes.NotFound {
		t.Fatalf("expected NotFound for missing key, got %v", err)
	}
}

func TestServerHealth(t *testing.T) {
	s := newTestServer()
	resp, err := s.Health(context.Background(), &pb.HealthRequest{})
	if err != nil || resp.Status != "healthy" {
		t.Fatalf("health: %v %v", err, resp)
	}
}
