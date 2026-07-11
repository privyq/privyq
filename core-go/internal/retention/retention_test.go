package retention

import (
	"testing"
	"time"

	"github.com/privyq/privyq/core-go/pkg/types"
)

func rfc(t time.Time) string { return t.Format(time.RFC3339) }

func TestPolicyDefaultAndCustom(t *testing.T) {
	if New(0).MaxAge != DefaultDays*24*time.Hour {
		t.Fatal("days<=0 should give the 7-year default")
	}
	if New(30).MaxAge != 30*24*time.Hour {
		t.Fatal("custom days not honoured")
	}
}

func TestPartitionEvidence(t *testing.T) {
	now := time.Date(2026, 7, 11, 0, 0, 0, 0, time.UTC)
	p := New(365) // 1 year
	entries := []types.Evidence{
		{EvidenceID: "old", Timestamp: rfc(now.AddDate(-2, 0, 0))},    // 2y old -> expired
		{EvidenceID: "recent", Timestamp: rfc(now.AddDate(0, -1, 0))}, // 1mo old -> keep
		{EvidenceID: "nodate", Timestamp: "not-a-time"},               // unparseable -> keep (fail safe)
	}
	keep, expired := p.PartitionEvidence(entries, now)
	if len(expired) != 1 || expired[0].EvidenceID != "old" {
		t.Fatalf("expected only 'old' expired, got %+v", expired)
	}
	if len(keep) != 2 {
		t.Fatalf("expected 2 kept (recent + undateable), got %d", len(keep))
	}
}

func TestExpiredKeys(t *testing.T) {
	now := time.Date(2026, 7, 11, 0, 0, 0, 0, time.UTC)
	keys := []types.KeyInfo{
		{KeyID: "k_expired", ExpiresAt: rfc(now.AddDate(0, 0, -1)), Status: types.StatusActive},
		{KeyID: "k_future", ExpiresAt: rfc(now.AddDate(0, 0, 1)), Status: types.StatusActive},
		{KeyID: "k_noexp", Status: types.StatusActive},
		{KeyID: "k_already", ExpiresAt: rfc(now.AddDate(0, 0, -5)), Status: types.StatusExpired},
		{KeyID: "k_revoked", ExpiresAt: rfc(now.AddDate(0, 0, -5)), Status: types.StatusRevoked},
	}
	got := ExpiredKeys(keys, now)
	if len(got) != 1 || got[0] != "k_expired" {
		t.Fatalf("expected only k_expired, got %v", got)
	}
}
