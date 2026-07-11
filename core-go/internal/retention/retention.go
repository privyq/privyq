// Package retention implements configurable data retention and archival
// (ARCH §12.3, v2 blueprint §12 — closes v1 gap B8). The default retention is
// seven years, matching common healthcare/financial requirements.
//
// The evidence chain is append-only and hash-linked, so retention ARCHIVES
// expired evidence (exports it, then it may be pruned behind a checkpoint) rather
// than silently deleting links out of the middle of a live chain. Keys past their
// expiry are transitioned to Expired.
package retention

import (
	"time"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// DefaultDays is ~7 years.
const DefaultDays = 7 * 365

// Policy is a retention window.
type Policy struct {
	MaxAge time.Duration
}

// New builds a Policy from a day count; days <= 0 uses the 7-year default.
func New(days int) Policy {
	if days <= 0 {
		days = DefaultDays
	}
	return Policy{MaxAge: time.Duration(days) * 24 * time.Hour}
}

// Cutoff is the oldest timestamp still within retention as of now.
func (p Policy) Cutoff(now time.Time) time.Time { return now.Add(-p.MaxAge) }

// Expired reports whether something timestamped ts is past retention as of now.
func (p Policy) Expired(ts, now time.Time) bool { return ts.Before(p.Cutoff(now)) }

// PartitionEvidence splits entries into those to keep and those past retention
// (candidates for archival). Entries with an unparseable timestamp are kept
// (fail safe — never archive something we can't date).
func (p Policy) PartitionEvidence(entries []types.Evidence, now time.Time) (keep, expired []types.Evidence) {
	cutoff := p.Cutoff(now)
	for _, e := range entries {
		ts, err := time.Parse(time.RFC3339, e.Timestamp)
		if err == nil && ts.Before(cutoff) {
			expired = append(expired, e)
		} else {
			keep = append(keep, e)
		}
	}
	return keep, expired
}

// ExpiredKeys returns the ids of keys whose ExpiresAt has passed as of now.
// (Retention of key metadata; the key material itself follows key lifecycle.)
func ExpiredKeys(keys []types.KeyInfo, now time.Time) []string {
	var ids []string
	for _, k := range keys {
		if k.ExpiresAt == "" {
			continue
		}
		exp, err := time.Parse(time.RFC3339, k.ExpiresAt)
		if err == nil && exp.Before(now) && k.Status != types.StatusExpired && k.Status != types.StatusRevoked {
			ids = append(ids, k.KeyID)
		}
	}
	return ids
}
