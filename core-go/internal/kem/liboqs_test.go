//go:build liboqs

package kem

import (
	"bytes"
	"testing"
)

// Exercised only in the CGO liboqs build (`go test -tags liboqs`). Proves the
// liboqs ML-KEM backend round-trips a shared secret.
func TestLiboqsKEMRoundTrip(t *testing.T) {
	t.Setenv("PQC_BACKEND", "liboqs")
	for _, algo := range []string{"kyber_512", "kyber_768", "kyber_1024"} {
		t.Run(algo, func(t *testing.T) {
			if !Supported(algo) {
				t.Fatalf("%s should be supported under liboqs", algo)
			}
			s, err := New(algo)
			if err != nil {
				t.Fatal(err)
			}
			pk, sk, err := s.GenerateKeyPair()
			if err != nil {
				t.Fatal(err)
			}
			ct, ss1, err := s.Encapsulate(pk)
			if err != nil {
				t.Fatal(err)
			}
			ss2, err := s.Decapsulate(sk, ct)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(ss1, ss2) {
				t.Fatal("encapsulated and decapsulated shared secrets differ")
			}
			if len(ss1) != s.SharedSecretSize() {
				t.Fatalf("shared secret size %d != reported %d", len(ss1), s.SharedSecretSize())
			}
		})
	}
}
