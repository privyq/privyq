// Package signatures provides post-quantum digital signatures behind a pluggable
// backend (v2 blueprint §8).
//
//   - The DEFAULT backend is "circl" — Cloudflare CIRCL, pure Go, no CGO. It
//     provides ML-DSA (Dilithium) and SLH-DSA (SPHINCS+). This is what a stock
//     build ships with, and what every test here exercises.
//   - An OPTIONAL "liboqs" backend (build tag `liboqs`, CGO) adds Falcon (FN-DSA)
//     and reference-library parity. It is compiled in only with `-tags liboqs`.
//
// The active backend is chosen at runtime by the PQC_BACKEND environment variable
// (default "circl"). Selecting a backend that was not compiled in fails with a
// clear error rather than silently falling back — honesty over surprise.
package signatures

import (
	"fmt"
	"os"
	"sort"
	"strings"
)

// Scheme is a post-quantum signature scheme with opaque byte-slice keys.
type Scheme interface {
	Name() string
	GenerateKeyPair() (publicKey, privateKey []byte, err error)
	Sign(privateKey, message []byte) ([]byte, error)
	Verify(publicKey, message, signature []byte) bool
}

// Backend is a provider of signature schemes (CIRCL, liboqs, ...).
type Backend interface {
	New(algorithm string) (Scheme, error)
	Supported(algorithm string) bool
}

var backends = map[string]Backend{}

// registerBackend is called from each backend's init(). CIRCL is always present;
// liboqs registers itself only when compiled with `-tags liboqs`.
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

// New returns the signature Scheme for a PrivyQ algorithm id (e.g. "dilithium_3",
// or "falcon_512" under liboqs) using the active backend.
func New(algorithm string) (Scheme, error) {
	b, ok := backends[BackendName()]
	if !ok {
		return nil, fmt.Errorf("signatures: PQC_BACKEND=%q is not available in this build (available: %s; build with -tags liboqs to enable liboqs)", BackendName(), availableBackends())
	}
	return b.New(algorithm)
}

// Supported reports whether the algorithm id is available in the active backend.
func Supported(algorithm string) bool {
	b, ok := backends[BackendName()]
	return ok && b.Supported(algorithm)
}
