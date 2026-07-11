package audit

// Evidence export for compliance reporting (v2 blueprint §12, closes v1 gap B9).
// Renders the (already cryptographically verifiable) evidence chain as JSON, CSV,
// or a self-contained PDF report. Zero external dependencies — the PDF is written
// by a tiny built-in generator so the default build stays dependency-light.

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/privyq/privyq/core-go/pkg/types"
)

// Export renders entries in the requested format. chainVerified is the result of
// verifying the whole chain, surfaced in the report so a reader knows the export
// reflects an intact, tamper-free log. Supported formats: json, csv, pdf.
func Export(entries []types.Evidence, format string, chainVerified bool) (content []byte, contentType, filename string, err error) {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "", "json":
		return exportJSON(entries, chainVerified)
	case "csv":
		return exportCSV(entries)
	case "pdf":
		return exportPDF(entries, chainVerified), "application/pdf", "evidence.pdf", nil
	default:
		return nil, "", "", fmt.Errorf("audit: unsupported export format %q (use json|csv|pdf)", format)
	}
}

func exportJSON(entries []types.Evidence, chainVerified bool) ([]byte, string, string, error) {
	b, err := json.MarshalIndent(map[string]any{
		"report":         "privyq-evidence",
		"chain_verified": chainVerified,
		"entry_count":    len(entries),
		"entries":        entries,
	}, "", "  ")
	if err != nil {
		return nil, "", "", err
	}
	return b, "application/json", "evidence.json", nil
}

func exportCSV(entries []types.Evidence) ([]byte, string, string, error) {
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	_ = w.Write([]string{"position", "evidence_id", "timestamp", "operation", "result",
		"resource_id", "actor_id", "actor_role", "reason", "parent_hash", "signing_algorithm"})
	for _, e := range entries {
		_ = w.Write([]string{
			strconv.FormatInt(e.Position, 10), e.EvidenceID, e.Timestamp, e.Operation, e.Result,
			e.ResourceID, e.Actor.UserID, e.Actor.Role, e.PolicyEvaluation.Reason, e.ParentHash, e.SigningAlgorithm,
		})
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return nil, "", "", err
	}
	return buf.Bytes(), "text/csv", "evidence.csv", nil
}

func exportPDF(entries []types.Evidence, chainVerified bool) []byte {
	lines := []string{
		"PrivyQ - Cryptographic Evidence Report",
		fmt.Sprintf("Entries: %d    Chain verified: %v", len(entries), chainVerified),
		strings.Repeat("-", 78),
		"",
	}
	for _, e := range entries {
		lines = append(lines,
			fmt.Sprintf("#%d  %s  %s -> %s", e.Position, e.Timestamp, e.Operation, e.Result),
			fmt.Sprintf("    resource=%s  actor=%s (%s)", e.ResourceID, e.Actor.UserID, e.Actor.Role))
		if reason := e.PolicyEvaluation.Reason; reason != "" {
			lines = append(lines, "    reason: "+reason)
		}
		lines = append(lines, "    sig="+truncate(e.Signature, 44)+"  parent="+truncate(e.ParentHash, 20), "")
	}
	return renderPDF(lines)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

// renderPDF writes a minimal, valid multi-page PDF (Courier, monospaced) from a
// list of text lines. No external dependency — the PDF spec's core objects are
// simple enough to emit directly.
func renderPDF(lines []string) []byte {
	const linesPerPage = 56
	var pages [][]string
	for i := 0; i < len(lines); i += linesPerPage {
		end := i + linesPerPage
		if end > len(lines) {
			end = len(lines)
		}
		pages = append(pages, lines[i:end])
	}
	if len(pages) == 0 {
		pages = [][]string{{""}}
	}

	var objects []string
	add := func(body string) int { objects = append(objects, body); return len(objects) }

	catalog := add("")                                                  // 1
	add("")                                                             // 2 (pages, filled below)
	font := add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>") // 3

	var kids []string
	for _, pageLines := range pages {
		var sb strings.Builder
		sb.WriteString("BT /F1 9 Tf 50 750 Td 11 TL\n")
		for i, ln := range pageLines {
			if i == 0 {
				sb.WriteString("(" + pdfEscape(ln) + ") Tj\n")
			} else {
				sb.WriteString("T* (" + pdfEscape(ln) + ") Tj\n")
			}
		}
		sb.WriteString("ET")
		stream := sb.String()
		content := add(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(stream), stream))
		page := add(fmt.Sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> >> >>", content, font))
		kids = append(kids, fmt.Sprintf("%d 0 R", page))
	}
	objects[catalog-1] = "<< /Type /Catalog /Pages 2 0 R >>"
	objects[1] = fmt.Sprintf("<< /Type /Pages /Kids [%s] /Count %d >>", strings.Join(kids, " "), len(pages))

	var buf bytes.Buffer
	buf.WriteString("%PDF-1.4\n")
	offsets := make([]int, len(objects)+1)
	for i, body := range objects {
		offsets[i+1] = buf.Len()
		fmt.Fprintf(&buf, "%d 0 obj\n%s\nendobj\n", i+1, body)
	}
	xref := buf.Len()
	fmt.Fprintf(&buf, "xref\n0 %d\n0000000000 65535 f \n", len(objects)+1)
	for i := 1; i <= len(objects); i++ {
		fmt.Fprintf(&buf, "%010d 00000 n \n", offsets[i])
	}
	fmt.Fprintf(&buf, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF", len(objects)+1, xref)
	return buf.Bytes()
}

func pdfEscape(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "(", "\\(")
	s = strings.ReplaceAll(s, ")", "\\)")
	var b strings.Builder
	for _, r := range s {
		if r >= 32 && r < 127 {
			b.WriteRune(r)
		} else {
			b.WriteByte(' ')
		}
	}
	return b.String()
}
