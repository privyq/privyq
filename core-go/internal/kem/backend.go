// Package kem provides post-quantum Key Encapsulation Mechanisms behind a
// pluggable backend (v2 blueprint §8).
//
//   - The DEFAULT backend is "circl" — Cloudflare CIRCL, pure Go, no CGO,
//     providing ML-KEM (Kyber). This is what a stock build ships with.
//   - An OPTIONAL "liboqs" backend (build tag `liboqs`, CGO) provides ML-KEM via
//     the Open Quantum Safe library, compiled in only with `-tags liboqs`.
//
// The active backend is chosen at runtime by PQC_BACKEND (default "circl").
package kem

import (
	"fmt"
	"os"
	"sort"
	"strings"
)

// Scheme is a post-quantum KEM. Keys are opaque byte slices so the rest of the
// core never depends on a concrete crypto library's types.
type Scheme interface {
	Name() string
	GenerateKeyPair() (publicKey, privateKey []byte, err error)
	// Encapsulate produces a ciphertext and the shared secret for the holder of publicKey.
	Encapsulate(publicKey []byte) (ciphertext, sharedSecret []byte, err error)
	// Decapsulate recovers the shared secret from ciphertext using privateKey.
	Decapsulate(privateKey, ciphertext []byte) (sharedSecret []byte, err error)
	SharedSecretSize() int
}

// Backend is a provider of KEM schemes (CIRCL, liboqs, ...).
type Backend interface {
	New(algorithm string) (Scheme, error)
	Supported(algorithm string) bool
}

var backends = map[string]Backend{}

func registerBackend(name string, b Backend) { backends[name] = b }

// BackendName reports the active backend id (PQC_BACKEND, default "circl").
func BackendName() string {
	if v := strings.TrimSpace(os.Getenv("PQC_BACKEND")); v != "" {
		return strings.ToLower(v)
	}
	return "circl"
}

func availableBackends() string {
	names := make([]string, 0, len(backends))
	for n := range backends {
		names = append(names, n)
	}
	sort.Strings(names)
	return strings.Join(names, ", ")
}

// New returns the KEM Scheme for a PrivyQ algorithm id (e.g. "kyber_768") using
// the active backend.
func New(algorithm string) (Scheme, error) {
	b, ok := backends[BackendName()]
	if !ok {
		return nil, fmt.Errorf("kem: PQC_BACKEND=%q is not available in this build (available: %s; build with -tags liboqs to enable liboqs)", BackendName(), availableBackends())
	}
	return b.New(algorithm)
}

// Supported reports whether the algorithm id is available in the active backend.
func Supported(algorithm string) bool {
	b, ok := backends[BackendName()]
	return ok && b.Supported(algorithm)
}
