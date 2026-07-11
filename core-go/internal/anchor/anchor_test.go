package anchor

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestNewBackends(t *testing.T) {
	if a, err := New("", ""); err != nil || a.Name() != "none" {
		t.Fatalf("default should be the disabled 'none' anchor: %v", err)
	}
	if a, err := New("file", filepath.Join(t.TempDir(), "a.log")); err != nil || a.Name() != "file" {
		t.Fatalf("file backend: %v", err)
	}
	if _, err := New("dogecoin", ""); err == nil {
		t.Fatal("unknown backend should error")
	}
}

func TestNoopAnchor(t *testing.T) {
	a, _ := New("none", "")
	ref, err := a.Anchor("deadbeef")
	if err != nil || ref != "" {
		t.Fatalf("noop anchor should do nothing: ref=%q err=%v", ref, err)
	}
}

func TestFileAnchorNotarises(t *testing.T) {
	path := filepath.Join(t.TempDir(), "anchors.log")
	a, _ := New("file", path)
	ref1, err := a.Anchor("root-aaa")
	if err != nil || ref1 == "" {
		t.Fatalf("anchor 1: %v", err)
	}
	ref2, _ := a.Anchor("root-bbb")
	if ref1 == ref2 {
		t.Fatal("each anchor should get a distinct reference")
	}

	// The notary file must contain both roots, in order.
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	var roots []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		var rec struct {
			Seq  int    `json:"seq"`
			Root string `json:"root"`
		}
		if err := json.Unmarshal(sc.Bytes(), &rec); err != nil {
			t.Fatalf("bad record: %v", err)
		}
		roots = append(roots, rec.Root)
	}
	if len(roots) != 2 || roots[0] != "root-aaa" || roots[1] != "root-bbb" {
		t.Fatalf("notary file wrong: %v", roots)
	}
}
