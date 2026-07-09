package grpc

import (
	"encoding/json"

	"github.com/privyq/privyq/core-go/internal/keymanager"
	"github.com/privyq/privyq/core-go/pkg/pb"
	"github.com/privyq/privyq/core-go/pkg/types"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// mapErr translates domain errors to gRPC status codes (ARCH §21.3).
func mapErr(err error) error {
	switch err {
	case keymanager.ErrKeyNotFound:
		return status.Error(codes.NotFound, err.Error())
	default:
		return status.Error(codes.Internal, err.Error())
	}
}

func marshalEnvelope(env *types.ProtectedData) ([]byte, error) { return json.Marshal(env) }

// ── proto → domain ──

func policyFromPB(p *pb.Policy) types.Policy {
	if p == nil {
		return types.Policy{Version: types.PolicyVersion, Combination: "all"}
	}
	conds := make([]types.Condition, 0, len(p.Conditions))
	for _, c := range p.Conditions {
		conds = append(conds, types.Condition{Type: c.Type, Operator: c.Operator, Values: c.Values, Negate: c.Negate})
	}
	return types.Policy{Version: p.Version, Conditions: conds, Combination: p.Combination, CustomLogic: p.CustomLogic, Metadata: p.Metadata}
}

func identityFromPB(i *pb.Identity) types.Identity {
	if i == nil {
		return types.Identity{}
	}
	return types.Identity{
		UserID: i.UserId, Role: i.Role, Department: i.Department, Purpose: i.Purpose,
		Organization: i.Organization, Classification: i.Classification, Jurisdiction: i.Jurisdiction,
		Attributes: i.Attributes,
	}
}

func contextFromPB(c *pb.Context) types.Context {
	if c == nil {
		return types.Context{}
	}
	return types.Context{Timestamp: c.Timestamp, IPAddress: c.IpAddress, SessionID: c.SessionId, UserAgent: c.UserAgent}
}

func evalFromPB(e *pb.PolicyEvaluation) types.PolicyEvaluation {
	if e == nil {
		return types.PolicyEvaluation{}
	}
	crs := make([]types.ConditionResult, 0, len(e.EvaluatedConditions))
	for _, c := range e.EvaluatedConditions {
		crs = append(crs, types.ConditionResult{Type: c.Type, Expected: c.Expected, Actual: c.Actual, Result: c.Result})
	}
	return types.PolicyEvaluation{Decision: e.Decision, Reason: e.Reason, EvaluatedConditions: crs}
}

func evidenceFromPB(e *pb.Evidence) types.Evidence {
	if e == nil {
		return types.Evidence{}
	}
	return types.Evidence{
		EvidenceID: e.EvidenceId, Version: e.Version, Timestamp: e.Timestamp,
		Actor: identityFromPB(e.Actor), ResourceID: e.ResourceId, ResourceHash: e.ResourceHash,
		Policy: policyFromPB(e.Policy), Operation: e.Operation, Result: e.Result,
		PolicyEvaluation: evalFromPB(e.PolicyEvaluation), Signature: e.Signature,
		PublicKeyID: e.PublicKeyId, SigningAlgorithm: e.SigningAlgorithm,
		ParentHash: e.ParentHash, Position: e.Position, Metadata: e.Metadata,
	}
}

// ── domain → proto ──

func policyToPB(p types.Policy) *pb.Policy {
	conds := make([]*pb.Condition, 0, len(p.Conditions))
	for _, c := range p.Conditions {
		conds = append(conds, &pb.Condition{Type: c.Type, Operator: c.Operator, Values: c.Values, Negate: c.Negate})
	}
	return &pb.Policy{Version: p.Version, Conditions: conds, Combination: p.Combination, CustomLogic: p.CustomLogic, Metadata: p.Metadata}
}

func identityToPB(i types.Identity) *pb.Identity {
	return &pb.Identity{
		UserId: i.UserID, Role: i.Role, Department: i.Department, Purpose: i.Purpose,
		Organization: i.Organization, Classification: i.Classification, Jurisdiction: i.Jurisdiction, Attributes: i.Attributes,
	}
}

func evalToPB(e types.PolicyEvaluation) *pb.PolicyEvaluation {
	crs := make([]*pb.ConditionResult, 0, len(e.EvaluatedConditions))
	for _, c := range e.EvaluatedConditions {
		crs = append(crs, &pb.ConditionResult{Type: c.Type, Expected: c.Expected, Actual: c.Actual, Result: c.Result})
	}
	return &pb.PolicyEvaluation{Decision: e.Decision, Reason: e.Reason, EvaluatedConditions: crs}
}

func evidenceToPB(e types.Evidence) *pb.Evidence {
	return &pb.Evidence{
		EvidenceId: e.EvidenceID, Version: e.Version, Timestamp: e.Timestamp,
		Actor: identityToPB(e.Actor), ResourceId: e.ResourceID, ResourceHash: e.ResourceHash,
		Policy: policyToPB(e.Policy), Operation: e.Operation, Result: e.Result,
		PolicyEvaluation: evalToPB(e.PolicyEvaluation), Signature: e.Signature,
		PublicKeyId: e.PublicKeyID, SigningAlgorithm: e.SigningAlgorithm,
		ParentHash: e.ParentHash, Position: e.Position, Metadata: e.Metadata,
	}
}

func keyToPB(k types.KeyInfo) *pb.KeyInfo {
	return &pb.KeyInfo{
		KeyId: k.KeyID, Version: k.Version, Algorithm: k.Algorithm, Type: string(k.Type),
		PublicKey: k.PublicKey, Status: string(k.Status), CreatedAt: k.CreatedAt, ExpiresAt: k.ExpiresAt,
		RotatedAt: k.RotatedAt, RevokedAt: k.RevokedAt, Organization: k.Organization, Owner: k.Owner, Metadata: k.Metadata,
	}
}
