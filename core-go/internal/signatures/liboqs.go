//go:build liboqs

// Optional liboqs (Open Quantum Safe) signature backend, compiled only with
// `-tags liboqs` (CGO). It adds Falcon (FN-DSA) alongside ML-DSA and SPHINCS+ and
// gives reference-library parity for organisations that require liboqs.
//
// Build/run prerequisites (see core-go/README):
//   - liboqs installed with a pkg-config file on PKG_CONFIG_PATH
//   - the shared library reachable at runtime (LD_LIBRARY_PATH or rpath)
//   - select it at runtime with PQC_BACKEND=liboqs

package signatures

/*
#cgo pkg-config: liboqs
#include <oqs/oqs.h>
#include <stdlib.h>
*/
import "C"

import (
	"fmt"
	"unsafe"
)

func init() { registerBackend("liboqs", liboqsBackend{}) }

// liboqsSigMap maps PrivyQ algorithm ids to liboqs method names (standardised
// NIST names where available; Falcon is liboqs-only).
var liboqsSigMap = map[string]string{
	"dilithium_2":  "ML-DSA-44",
	"dilithium_3":  "ML-DSA-65",
	"dilithium_5":  "ML-DSA-87",
	"falcon_512":   "Falcon-512",
	"falcon_1024":  "Falcon-1024",
	"sphincs_128s": "SLH_DSA_PURE_SHA2_128S", // SPHINCS+ is SLH-DSA in liboqs >= 0.13
	"sphincs_192s": "SLH_DSA_PURE_SHA2_192S",
	"sphincs_256s": "SLH_DSA_PURE_SHA2_256S",
}

type liboqsBackend struct{}

func (liboqsBackend) Supported(algorithm string) bool {
	method, ok := liboqsSigMap[algorithm]
	if !ok {
		return false
	}
	cname := C.CString(method)
	defer C.free(unsafe.Pointer(cname))
	return C.OQS_SIG_alg_is_enabled(cname) == 1
}

func (liboqsBackend) New(algorithm string) (Scheme, error) {
	method, ok := liboqsSigMap[algorithm]
	if !ok {
		return nil, fmt.Errorf("signatures/liboqs: unsupported algorithm %q", algorithm)
	}
	return &liboqsScheme{name: algorithm, method: method}, nil
}

type liboqsScheme struct {
	name   string
	method string
}

func (s *liboqsScheme) Name() string { return s.name }

// newSig allocates a fresh OQS_SIG handle; callers must OQS_SIG_free it.
func (s *liboqsScheme) newSig() (*C.OQS_SIG, error) {
	cname := C.CString(s.method)
	defer C.free(unsafe.Pointer(cname))
	sig := C.OQS_SIG_new(cname)
	if sig == nil {
		return nil, fmt.Errorf("signatures/liboqs: algorithm %q is not enabled in this liboqs build", s.method)
	}
	return sig, nil
}

func u8(b []byte) *C.uint8_t {
	if len(b) == 0 {
		return nil
	}
	return (*C.uint8_t)(unsafe.Pointer(&b[0]))
}

func (s *liboqsScheme) GenerateKeyPair() ([]byte, []byte, error) {
	sig, err := s.newSig()
	if err != nil {
		return nil, nil, err
	}
	defer C.OQS_SIG_free(sig)
	pk := make([]byte, int(sig.length_public_key))
	sk := make([]byte, int(sig.length_secret_key))
	if C.OQS_SIG_keypair(sig, u8(pk), u8(sk)) != C.OQS_SUCCESS {
		return nil, nil, fmt.Errorf("signatures/liboqs: key generation failed for %q", s.method)
	}
	return pk, sk, nil
}

func (s *liboqsScheme) Sign(privateKey, message []byte) ([]byte, error) {
	sig, err := s.newSig()
	if err != nil {
		return nil, err
	}
	defer C.OQS_SIG_free(sig)
	signature := make([]byte, int(sig.length_signature))
	var sigLen C.size_t
	st := C.OQS_SIG_sign(sig, u8(signature), &sigLen, u8(message), C.size_t(len(message)), u8(privateKey))
	if st != C.OQS_SUCCESS {
		return nil, fmt.Errorf("signatures/liboqs: sign failed for %q", s.method)
	}
	return signature[:int(sigLen)], nil
}

func (s *liboqsScheme) Verify(publicKey, message, signature []byte) bool {
	sig, err := s.newSig()
	if err != nil {
		return false
	}
	defer C.OQS_SIG_free(sig)
	st := C.OQS_SIG_verify(sig, u8(message), C.size_t(len(message)), u8(signature), C.size_t(len(signature)), u8(publicKey))
	return st == C.OQS_SUCCESS
}
