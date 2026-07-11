// Package grpc implements the PrivyQCore gRPC service (ARCH §7.3, §8). It is a
// thin adapter: it converts protobuf messages to/from the domain types in
// pkg/types and delegates all logic to internal/core.
package grpc

import (
	"context"

	"github.com/privyq/privyq/core-go/internal/audit"
	"github.com/privyq/privyq/core-go/internal/core"
	"github.com/privyq/privyq/core-go/pkg/pb"
	"github.com/privyq/privyq/core-go/pkg/types"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Server adapts core.Service to the generated gRPC interface.
type Server struct {
	pb.UnimplementedPrivyQCoreServer
	svc *core.Service
}

// NewServer wraps a core.Service.
func NewServer(svc *core.Service) *Server { return &Server{svc: svc} }

func (s *Server) GenerateKey(_ context.Context, r *pb.GenerateKeyRequest) (*pb.GenerateKeyResponse, error) {
	kt := types.KeyEncryption
	if r.Type == "signing" {
		kt = types.KeySigning
	}
	info, err := s.svc.Keys.Generate(r.Algorithm, kt, r.Organization, r.Owner, r.Metadata)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &pb.GenerateKeyResponse{Key: keyToPB(info)}, nil
}

func (s *Server) RotateKey(_ context.Context, r *pb.RotateKeyRequest) (*pb.RotateKeyResponse, error) {
	oldInfo, newInfo, err := s.svc.Keys.Rotate(r.KeyId, r.GracePeriod)
	if err != nil {
		return nil, mapErr(err)
	}
	return &pb.RotateKeyResponse{OldKeyId: oldInfo.KeyID, NewKeyId: newInfo.KeyID, RotatedAt: oldInfo.RotatedAt, GracePeriod: r.GracePeriod}, nil
}

func (s *Server) RevokeKey(_ context.Context, r *pb.RevokeKeyRequest) (*pb.RevokeKeyResponse, error) {
	info, err := s.svc.Keys.Revoke(r.KeyId, r.Reason)
	if err != nil {
		return nil, mapErr(err)
	}
	return &pb.RevokeKeyResponse{KeyId: info.KeyID, RevokedAt: info.RevokedAt}, nil
}

func (s *Server) GetPublicKey(_ context.Context, r *pb.GetPublicKeyRequest) (*pb.GetPublicKeyResponse, error) {
	info, err := s.svc.Keys.Info(r.KeyId)
	if err != nil {
		return nil, mapErr(err)
	}
	return &pb.GetPublicKeyResponse{Key: keyToPB(info)}, nil
}

func (s *Server) Protect(_ context.Context, r *pb.ProtectRequest) (*pb.ProtectResponse, error) {
	env, ev, err := s.svc.Protect(r.Plaintext, policyFromPB(r.Policy), r.Algorithm, r.KeyId, r.ResourceId, identityFromPB(r.Actor))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	raw, err := marshalEnvelope(env)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &pb.ProtectResponse{
		ProtectedData: raw,
		KeyId:         env.KeyID,
		Algorithm:     env.Algorithm,
		PolicyHash:    core.PolicyHash(env.Policy),
		Timestamp:     env.Metadata["created_at"],
		Evidence:      evidenceToPB(ev),
	}, nil
}

func (s *Server) Access(_ context.Context, r *pb.AccessRequest) (*pb.AccessResponse, error) {
	data, ev, err := s.svc.Access(r.ProtectedData, identityFromPB(r.Identity), contextFromPB(r.Context))
	if err != nil {
		if pv, ok := err.(*core.ErrPolicyViolation); ok {
			st := status.New(codes.PermissionDenied, pv.Error())
			return nil, st.Err()
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &pb.AccessResponse{Data: data, Evidence: evidenceToPB(ev)}, nil
}

func (s *Server) Sign(_ context.Context, r *pb.SignRequest) (*pb.SignResponse, error) {
	sig, keyID, algo, err := s.svc.Sign(r.Message, r.KeyId)
	if err != nil {
		return nil, mapErr(err)
	}
	return &pb.SignResponse{Signature: sig, PublicKeyId: keyID, Algorithm: algo}, nil
}

func (s *Server) Verify(_ context.Context, r *pb.VerifyRequest) (*pb.VerifyResponse, error) {
	ok, err := s.svc.Verify(r.Message, r.Signature, r.PublicKeyId)
	if err != nil {
		return nil, mapErr(err)
	}
	return &pb.VerifyResponse{Valid: ok}, nil
}

// Seal is the v2 `seal()` verb — a self-describing post-quantum signature.
func (s *Server) Seal(_ context.Context, r *pb.SealRequest) (*pb.SealResponse, error) {
	sealed, err := s.svc.Seal(r.Data, r.KeyId, r.Algorithm)
	if err != nil {
		return nil, mapErr(err)
	}
	return &pb.SealResponse{Sealed: sealedToPB(sealed)}, nil
}

// VerifySeal checks a Sealed signature (dispatched to by the SDK's verify()).
func (s *Server) VerifySeal(_ context.Context, r *pb.VerifySealRequest) (*pb.VerifySealResponse, error) {
	ok, err := s.svc.VerifySeal(r.Data, sealedFromPB(r.Sealed))
	if err != nil {
		return nil, mapErr(err)
	}
	detail := "signature valid"
	if !ok {
		detail = "signature invalid or data hash mismatch"
	}
	return &pb.VerifySealResponse{Valid: ok, Detail: detail}, nil
}

func (s *Server) GenerateEvidence(_ context.Context, r *pb.GenerateEvidenceRequest) (*pb.GenerateEvidenceResponse, error) {
	ev, err := s.svc.GenerateEvidence(audit.GenerateParams{
		Actor: identityFromPB(r.Actor), ResourceID: r.ResourceId, ResourceHash: r.ResourceHash,
		Policy: policyFromPB(r.Policy), Operation: r.Operation, Evaluation: evalFromPB(r.PolicyEvaluation),
		Metadata: r.Metadata,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &pb.GenerateEvidenceResponse{Evidence: evidenceToPB(ev)}, nil
}

func (s *Server) VerifyEvidence(_ context.Context, r *pb.VerifyEvidenceRequest) (*pb.VerifyEvidenceResponse, error) {
	res := s.svc.VerifyEvidence(evidenceFromPB(r.Evidence), r.ReevaluatePolicy)
	return &pb.VerifyEvidenceResponse{
		Verified: res.Verified, SignatureValid: res.SignatureValid,
		ChainValid: res.ChainValid, PolicyCompliant: res.PolicyCompliant, Detail: res.Detail,
	}, nil
}

func (s *Server) GetEvidenceLog(_ context.Context, r *pb.GetEvidenceLogRequest) (*pb.GetEvidenceLogResponse, error) {
	entries, total, chainOK, err := s.svc.EvidenceLog(audit.Filter{
		ResourceID: r.ResourceId, ActorID: r.ActorId, StartTime: r.StartTime, EndTime: r.EndTime,
	}, int(r.Page), int(r.PageSize))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	out := make([]*pb.Evidence, 0, len(entries))
	for _, e := range entries {
		out = append(out, evidenceToPB(e))
	}
	return &pb.GetEvidenceLogResponse{Entries: out, Total: int32(total), Page: r.Page, PageSize: r.PageSize, ChainVerified: chainOK}, nil
}

func (s *Server) ListKeys(_ context.Context, _ *pb.ListKeysRequest) (*pb.ListKeysResponse, error) {
	infos, err := s.svc.ListKeys()
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	out := make([]*pb.KeyInfo, 0, len(infos))
	for _, i := range infos {
		out = append(out, keyToPB(i))
	}
	return &pb.ListKeysResponse{Keys: out}, nil
}

func (s *Server) EvaluatePolicy(_ context.Context, r *pb.EvaluatePolicyRequest) (*pb.EvaluatePolicyResponse, error) {
	eval := s.svc.EvaluatePolicy(policyFromPB(r.Policy), identityFromPB(r.Identity), contextFromPB(r.Context))
	return &pb.EvaluatePolicyResponse{Evaluation: evalToPB(eval)}, nil
}

// Check is the v2 PDP decision (no data revealed) — the `check()` verb.
func (s *Server) Check(_ context.Context, r *pb.CheckRequest) (*pb.CheckResponse, error) {
	decision, ev, err := s.svc.Check(r.ProtectedData, policyFromPB(r.Policy), identityFromPB(r.Identity), contextFromPB(r.Context), r.EmitEvidence)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	resp := &pb.CheckResponse{Decision: decisionToPB(decision)}
	if r.EmitEvidence {
		resp.Evidence = evidenceToPB(ev)
	}
	return resp, nil
}

func (s *Server) Health(_ context.Context, _ *pb.HealthRequest) (*pb.HealthResponse, error) {
	return &pb.HealthResponse{Status: "healthy", Version: s.svc.Version(), Services: map[string]string{"core": "healthy"}}, nil
}
