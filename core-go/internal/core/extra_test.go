package core

import (
	"encoding/json"
	"testing"

	"github.com/privyq/privyq/core-go/internal/audit"
	"github.com/privyq/privyq/core-go/pkg/types"
)

func TestSignAndVerify(t *testing.T) {
	svc := newService()
	sig, keyID, algo, err := svc.Sign([]byte("hello"), "")
	if err != nil {
		t.Fatal(err)
	}
	if keyID == "" || algo == "" {
		t.Fatal("sign should return a key id and algorithm")
	}
	ok, err := svc.Verify([]byte("hello"), sig, keyID)
	if err != nil || !ok {
		t.Fatalf("verify failed: %v ok=%v", err, ok)
	}
	// Wrong message must not verify.
	bad, _ := svc.Verify([]byte("tampered"), sig, keyID)
	if bad {
		t.Fatal("verify must fail for a different message")
	}
}

func TestGenerateAndVerifyEvidenceStandalone(t *testing.T) {
	svc := newService()
	ev, err := svc.GenerateEvidence(audit.GenerateParams{
		Actor:      types.Identity{UserID: "auditor", Role: "admin"},
		ResourceID: "r1", ResourceHash: "hash",
		Operation:  "access",
		Evaluation: types.PolicyEvaluation{Decision: "granted", Reason: "ok"},
	})
	if err != nil {
		t.Fatal(err)
	}
	res := svc.VerifyEvidence(ev, true)
	if !res.Verified {
		t.Fatalf("standalone evidence should verify: %s", res.Detail)
	}
}

func TestEvidenceLogPagination(t *testing.T) {
	svc := newService()
	owner := types.Identity{UserID: "dr", Role: "doctor", Department: "cardiology"}
	for i := 0; i < 5; i++ {
		if _, _, err := svc.Protect([]byte("d"), medicalPolicy(), "", "", "res", owner); err != nil {
			t.Fatal(err)
		}
	}
	page1, total, chainOK, err := svc.EvidenceLog(audit.Filter{}, 1, 2)
	if err != nil {
		t.Fatal(err)
	}
	if total != 5 || !chainOK {
		t.Fatalf("expected 5 verified entries, got total=%d ok=%v", total, chainOK)
	}
	if len(page1) != 2 {
		t.Fatalf("page size 2 should return 2 entries, got %d", len(page1))
	}
	// Filter by resource.
	byRes, _, _, _ := svc.EvidenceLog(audit.Filter{ResourceID: "res"}, 1, 100)
	if len(byRes) != 5 {
		t.Fatalf("resource filter should match 5, got %d", len(byRes))
	}
}

func TestAccessWithUnknownKeyFails(t *testing.T) {
	svc := newService()
	owner := types.Identity{UserID: "dr", Role: "doctor", Department: "cardiology"}
	env, _, _ := svc.Protect([]byte("d"), medicalPolicy(), "", "", "r", owner)
	// Corrupt the key id so the private key can't be found.
	env.KeyID = "00000000-0000-0000-0000-000000000000"
	raw, _ := json.Marshal(env)
	_, _, err := svc.Access(raw, types.Identity{Role: "doctor", Department: "cardiology", Purpose: "treatment"}, types.Context{})
	if err == nil {
		t.Fatal("access with an unknown key must fail")
	}
}

func TestAccessMalformedEnvelope(t *testing.T) {
	svc := newService()
	if _, _, err := svc.Access([]byte("{not valid"), types.Identity{}, types.Context{}); err == nil {
		t.Fatal("malformed protected data must error")
	}
}

func TestPolicyHashStable(t *testing.T) {
	h1 := PolicyHash(medicalPolicy())
	h2 := PolicyHash(medicalPolicy())
	if h1 != h2 || len(h1) != 64 {
		t.Fatalf("policy hash should be a stable 64-char hex, got %q / %q", h1, h2)
	}
}

func TestErrPolicyViolationMessage(t *testing.T) {
	e := &ErrPolicyViolation{Reason: "role condition failed"}
	if e.Error() != "policy violation: role condition failed" {
		t.Fatalf("unexpected message: %q", e.Error())
	}
}

func TestProtectUnsupportedAlgorithm(t *testing.T) {
	svc := newService()
	if _, _, err := svc.Protect([]byte("d"), medicalPolicy(), "rsa_2048", "", "r", types.Identity{}); err == nil {
		t.Fatal("unsupported KEM algorithm must error")
	}
}

func TestProtectReusesProvidedKey(t *testing.T) {
	svc := newService()
	key, err := svc.Keys.Generate("kyber_768", types.KeyEncryption, "org", "owner", nil)
	if err != nil {
		t.Fatal(err)
	}
	env, _, err := svc.Protect([]byte("d"), medicalPolicy(), "", key.KeyID, "r", types.Identity{})
	if err != nil {
		t.Fatal(err)
	}
	if env.KeyID != key.KeyID {
		t.Fatalf("Protect should reuse the provided key: got %s want %s", env.KeyID, key.KeyID)
	}
}

func TestSignWithExplicitKey(t *testing.T) {
	svc := newService()
	key, _ := svc.Keys.Generate("dilithium_3", types.KeySigning, "org", "o", nil)
	sig, keyID, _, err := svc.Sign([]byte("m"), key.KeyID)
	if err != nil || keyID != key.KeyID {
		t.Fatalf("sign with explicit key failed: %v", err)
	}
	ok, _ := svc.Verify([]byte("m"), sig, key.KeyID)
	if !ok {
		t.Fatal("explicit-key signature should verify")
	}
}

func TestVerifyWithUnknownKeyErrors(t *testing.T) {
	svc := newService()
	if _, err := svc.Verify([]byte("m"), "AAAA", "missing-key"); err == nil {
		t.Fatal("verify with an unknown public key must error")
	}
}

func TestEvidenceLogDefaultPagination(t *testing.T) {
	svc := newService()
	owner := types.Identity{UserID: "dr", Role: "doctor", Department: "cardiology"}
	_, _, _ = svc.Protect([]byte("d"), medicalPolicy(), "", "", "r", owner)
	// page=0, pageSize=0 should fall back to sane defaults, not panic.
	entries, total, _, err := svc.EvidenceLog(audit.Filter{}, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if total != 1 || len(entries) != 1 {
		t.Fatalf("default pagination: total=%d len=%d", total, len(entries))
	}
}
