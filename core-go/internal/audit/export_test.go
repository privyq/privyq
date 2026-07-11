package audit

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"strings"
	"testing"

	"github.com/privyq/privyq/core-go/pkg/types"
)

func sampleEntries() []types.Evidence {
	return []types.Evidence{
		{Position: 0, EvidenceID: "e0", Timestamp: "2026-07-11T10:00:00Z", Operation: "access", Result: "granted",
			ResourceID: "patient_1", Actor: types.Identity{UserID: "dr", Role: "doctor"},
			PolicyEvaluation: types.PolicyEvaluation{Reason: "All conditions satisfied"}, Signature: "AAAA", ParentHash: "genesis", SigningAlgorithm: "dilithium_3"},
		{Position: 1, EvidenceID: "e1", Timestamp: "2026-07-11T10:05:00Z", Operation: "access", Result: "denied",
			ResourceID: "patient_1", Actor: types.Identity{UserID: "nu", Role: "nurse"},
			PolicyEvaluation: types.PolicyEvaluation{Reason: "role condition not met (needed equals doctor)"}, Signature: "BBBB", ParentHash: "hash0", SigningAlgorithm: "dilithium_3"},
	}
}

func TestExportJSON(t *testing.T) {
	content, ct, fn, err := Export(sampleEntries(), "json", true)
	if err != nil || ct != "application/json" || fn != "evidence.json" {
		t.Fatalf("unexpected: %v %s %s", err, ct, fn)
	}
	var doc map[string]any
	if err := json.Unmarshal(content, &doc); err != nil {
		t.Fatalf("json not valid: %v", err)
	}
	if doc["chain_verified"] != true || doc["entry_count"].(float64) != 2 {
		t.Fatalf("json fields wrong: %v", doc)
	}
}

func TestExportCSV(t *testing.T) {
	content, ct, _, err := Export(sampleEntries(), "csv", true)
	if err != nil || ct != "text/csv" {
		t.Fatalf("unexpected: %v %s", err, ct)
	}
	rows, err := csv.NewReader(bytes.NewReader(content)).ReadAll()
	if err != nil {
		t.Fatalf("csv not valid: %v", err)
	}
	if len(rows) != 3 { // header + 2
		t.Fatalf("expected 3 rows, got %d", len(rows))
	}
	if rows[0][0] != "position" || rows[2][4] != "denied" {
		t.Fatalf("csv content wrong: %v", rows)
	}
}

func TestExportPDF(t *testing.T) {
	content, ct, fn, err := Export(sampleEntries(), "pdf", true)
	if err != nil || ct != "application/pdf" || fn != "evidence.pdf" {
		t.Fatalf("unexpected: %v %s %s", err, ct, fn)
	}
	if !bytes.HasPrefix(content, []byte("%PDF-1.")) {
		t.Fatal("PDF must start with the %PDF magic")
	}
	if !bytes.Contains(content, []byte("startxref")) || !bytes.HasSuffix(content, []byte("%%EOF")) {
		t.Fatal("PDF must have an xref and EOF marker")
	}
	// Parenthesis in a reason must be escaped, not left raw to break the stream.
	if bytes.Contains(content, []byte("(needed equals doctor)")) {
		t.Fatal("unescaped parentheses would corrupt the PDF content stream")
	}
}

func TestExportManyPagesAndUnknown(t *testing.T) {
	// Force multiple pages.
	big := make([]types.Evidence, 200)
	for i := range big {
		big[i] = types.Evidence{Position: int64(i), EvidenceID: "e", Operation: "access", Result: "granted"}
	}
	pdf := exportPDF(big, true)
	if !bytes.Contains(pdf, []byte("/Count ")) || bytes.Count(pdf, []byte("/Type /Page ")) < 2 {
		t.Fatalf("expected a multi-page PDF")
	}
	if _, _, _, err := Export(nil, "xml", true); err == nil || !strings.Contains(err.Error(), "unsupported") {
		t.Fatal("unknown format should error")
	}
}
