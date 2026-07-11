// Package anchor notarises the evidence-chain root somewhere tamper-evident and
// operator-independent, so third parties can prove the log existed and is
// unaltered without trusting PrivyQ's operator (v2 blueprint §12, §14).
//
// Anchoring is OPT-IN and off the request path: a background job publishes the
// current chain root periodically. Backends: "none" (default, disabled) and
// "file" (a local append-only notary, provided and tested). Real blockchain
// adapters (e.g. an EVM contract that stores roots) implement the same Anchor
// interface and slot in via New without touching callers.
package anchor

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
)

// Anchor records a value (the chain root) and returns an opaque reference — a
// transaction id, a file offset, etc.
type Anchor interface {
	Anchor(root string) (ref string, err error)
	Name() string
}

// New builds an Anchor for the backend id. Unknown backends error clearly.
func New(backend, path string) (Anchor, error) {
	switch strings.ToLower(strings.TrimSpace(backend)) {
	case "", "none", "off":
		return noop{}, nil
	case "file":
		if path == "" {
			path = "anchors.log"
		}
		return &fileAnchor{path: path}, nil
	default:
		return nil, fmt.Errorf("anchor: unknown backend %q (use none|file, or a chain adapter)", backend)
	}
}

type noop struct{}

func (noop) Anchor(string) (string, error) { return "", nil }
func (noop) Name() string                  { return "none" }

type fileAnchor struct {
	mu   sync.Mutex
	path string
	n    int
}

func (f *fileAnchor) Name() string { return "file" }

// Anchor appends a notarisation record and returns a reference to it.
func (f *fileAnchor) Anchor(root string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	line, err := json.Marshal(struct {
		Seq  int    `json:"seq"`
		Root string `json:"root"`
	}{Seq: f.n, Root: root})
	if err != nil {
		return "", err
	}
	file, err := os.OpenFile(f.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return "", err
	}
	defer file.Close()
	if _, err := file.Write(append(line, '\n')); err != nil {
		return "", err
	}
	ref := fmt.Sprintf("file:%s#%d", f.path, f.n)
	f.n++
	return ref, nil
}
