// Package compliance turns the evidence chain into compliance reports
// (v2 blueprint §13). It maps observable, cryptographically-backed facts about
// access — that decisions were policy-governed, that the audit trail verifies,
// that purposes were recorded, that unauthorized attempts were denied — onto
// controls in GDPR, HIPAA, and SOC 2. It asserts only what the evidence shows.
package compliance

import "github.com/privyq/privyq/core-go/pkg/types"

// Framework is a compliance regime.
type Framework string

const (
	GDPR  Framework = "GDPR"
	HIPAA Framework = "HIPAA"
	SOC2  Framework = "SOC2"
)

// Control is one mapped control and whether the evidence demonstrates it.
type Control struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Satisfied bool   `json:"satisfied"`
	Basis     string `json:"basis"`
}

// Report is a compliance summary over a set of evidence entries.
type Report struct {
	Framework     Framework      `json:"framework"`
	GeneratedAt   string         `json:"generated_at"`
	TotalEvents   int            `json:"total_events"`
	Granted       int            `json:"granted"`
	Denied        int            `json:"denied"`
	ByPurpose     map[string]int `json:"by_purpose"`
	ChainVerified bool           `json:"chain_verified"`
	Controls      []Control      `json:"controls"`
}

// Generate builds a Report for the framework from the given entries.
func Generate(fw Framework, entries []types.Evidence, chainVerified bool, generatedAt string) Report {
	r := Report{
		Framework: fw, GeneratedAt: generatedAt, ByPurpose: map[string]int{},
		ChainVerified: chainVerified, TotalEvents: len(entries),
	}
	purposeLimited := true // any access with no recorded purpose weakens purpose limitation
	policyGoverned := len(entries) > 0
	for _, e := range entries {
		switch e.Result {
		case "granted":
			r.Granted++
		case "denied":
			r.Denied++
		}
		p := e.Actor.Purpose
		if p == "" {
			p = "(unspecified)"
			if e.Operation == "access" {
				purposeLimited = false
			}
		}
		r.ByPurpose[p]++
		if len(e.Policy.Conditions) == 0 && len(e.Policy.DenyConditions) == 0 && e.Policy.CustomLogic == "" {
			policyGoverned = false
		}
	}
	r.Controls = controlsFor(fw, r, policyGoverned, purposeLimited)
	return r
}

func controlsFor(fw Framework, r Report, policyGoverned, purposeLimited bool) []Control {
	auditOK := r.ChainVerified && r.TotalEvents > 0
	enforced := policyGoverned && r.TotalEvents > 0
	// A tamper-evident, verifiable trail is common to all three regimes.
	common := Control{"audit-trail", "Tamper-evident, verifiable audit trail", auditOK,
		"evidence chain is signed, hash-linked, and verified end-to-end"}
	access := Control{"access-control", "Access is policy-governed and enforced", enforced,
		"every access is an ABAC policy decision recorded as signed evidence"}
	denials := Control{"unauthorized-denied", "Unauthorized access is denied and recorded", r.Denied > 0 || r.TotalEvents == 0,
		"denied attempts produce signed evidence just like grants"}

	switch fw {
	case GDPR:
		return []Control{
			access,
			{"gdpr-5-1-b", "Art. 5(1)(b) Purpose limitation", purposeLimited && r.TotalEvents > 0,
				"access requests carry and are evaluated against a declared purpose"},
			{"gdpr-30", "Art. 30 Records of processing", auditOK,
				"the evidence chain is a verifiable record of every processing event"},
			common,
		}
	case HIPAA:
		return []Control{
			access,
			{"hipaa-164-312-b", "§164.312(b) Audit controls", auditOK,
				"cryptographic audit trail of all PHI access"},
			{"hipaa-min-necessary", "Minimum necessary / least privilege", enforced,
				"ABAC policies scope access to role, purpose, and context"},
			denials,
		}
	case SOC2:
		return []Control{
			access,
			{"soc2-cc6.1", "CC6.1 Logical access controls", enforced,
				"policy-governed authorization for every request"},
			{"soc2-cc7.2", "CC7.2 Monitoring", auditOK,
				"continuous, verifiable evidence of access activity"},
			denials,
		}
	default:
		return []Control{access, common, denials}
	}
}
