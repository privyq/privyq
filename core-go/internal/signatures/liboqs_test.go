//go:build liboqs

package signatures

import "testing"

// Exercised only in the CGO liboqs build (`go test -tags liboqs`). Proves the
// liboqs backend signs/verifies — including Falcon, which the default CIRCL
// backend does not provide.
func TestLiboqsSignVerify(t *testing.T) {
	t.Setenv("PQC_BACKEND", "liboqs")
	for _, algo := range []string{"dilithium_3", "falcon_512", "falcon_1024", "sphincs_128s"} {
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
			msg := []byte("post-quantum sealed message")
			sig, err := s.Sign(sk, msg)
			if err != nil {
				t.Fatal(err)
			}
			if !s.Verify(pk, msg, sig) {
				t.Fatal("a valid signature must verify")
			}
			tampered := append([]byte(nil), msg...)
			tampered[0] ^= 0xff
			if s.Verify(pk, tampered, sig) {
				t.Fatal("a tampered message must not verify")
			}
		})
	}
}

func TestLiboqsBackendSelection(t *testing.T) {
	t.Setenv("PQC_BACKEND", "liboqs")
	if BackendName() != "liboqs" {
		t.Fatalf("BackendName = %q, want liboqs", BackendName())
	}
	if !Supported("falcon_512") {
		t.Fatal("liboqs must support falcon_512")
	}
	// Falcon is liboqs-only: the default CIRCL backend must not claim it.
	t.Setenv("PQC_BACKEND", "circl")
	if Supported("falcon_512") {
		t.Fatal("circl backend must not support falcon_512")
	}
	if _, err := New("falcon_512"); err == nil {
		t.Fatal("circl New(falcon_512) should error")
	}
}
