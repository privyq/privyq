//go:build liboqs

// Optional liboqs (Open Quantum Safe) KEM backend, compiled only with
// `-tags liboqs` (CGO). Provides ML-KEM (Kyber) via the reference C library.
// Select it at runtime with PQC_BACKEND=liboqs.

package kem

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

var liboqsKemMap = map[string]string{
	"kyber_512":  "ML-KEM-512",
	"kyber_768":  "ML-KEM-768",
	"kyber_1024": "ML-KEM-1024",
}

type liboqsBackend struct{}

func (liboqsBackend) Supported(algorithm string) bool {
	method, ok := liboqsKemMap[algorithm]
	if !ok {
		return false
	}
	cname := C.CString(method)
	defer C.free(unsafe.Pointer(cname))
	return C.OQS_KEM_alg_is_enabled(cname) == 1
}

func (liboqsBackend) New(algorithm string) (Scheme, error) {
	method, ok := liboqsKemMap[algorithm]
	if !ok {
		return nil, fmt.Errorf("kem/liboqs: unsupported algorithm %q", algorithm)
	}
	k, err := newKEM(method)
	if err != nil {
		return nil, err
	}
	ss := int(k.length_shared_secret)
	C.OQS_KEM_free(k)
	return &liboqsScheme{name: algorithm, method: method, ssSize: ss}, nil
}

type liboqsScheme struct {
	name   string
	method string
	ssSize int
}

func (s *liboqsScheme) Name() string          { return s.name }
func (s *liboqsScheme) SharedSecretSize() int { return s.ssSize }

func newKEM(method string) (*C.OQS_KEM, error) {
	cname := C.CString(method)
	defer C.free(unsafe.Pointer(cname))
	k := C.OQS_KEM_new(cname)
	if k == nil {
		return nil, fmt.Errorf("kem/liboqs: algorithm %q is not enabled in this liboqs build", method)
	}
	return k, nil
}

func u8(b []byte) *C.uint8_t {
	if len(b) == 0 {
		return nil
	}
	return (*C.uint8_t)(unsafe.Pointer(&b[0]))
}

func (s *liboqsScheme) GenerateKeyPair() ([]byte, []byte, error) {
	k, err := newKEM(s.method)
	if err != nil {
		return nil, nil, err
	}
	defer C.OQS_KEM_free(k)
	pk := make([]byte, int(k.length_public_key))
	sk := make([]byte, int(k.length_secret_key))
	if C.OQS_KEM_keypair(k, u8(pk), u8(sk)) != C.OQS_SUCCESS {
		return nil, nil, fmt.Errorf("kem/liboqs: key generation failed for %q", s.method)
	}
	return pk, sk, nil
}

func (s *liboqsScheme) Encapsulate(publicKey []byte) ([]byte, []byte, error) {
	k, err := newKEM(s.method)
	if err != nil {
		return nil, nil, err
	}
	defer C.OQS_KEM_free(k)
	ct := make([]byte, int(k.length_ciphertext))
	ss := make([]byte, int(k.length_shared_secret))
	if C.OQS_KEM_encaps(k, u8(ct), u8(ss), u8(publicKey)) != C.OQS_SUCCESS {
		return nil, nil, fmt.Errorf("kem/liboqs: encapsulate failed for %q", s.method)
	}
	return ct, ss, nil
}

func (s *liboqsScheme) Decapsulate(privateKey, ciphertext []byte) ([]byte, error) {
	k, err := newKEM(s.method)
	if err != nil {
		return nil, err
	}
	defer C.OQS_KEM_free(k)
	ss := make([]byte, int(k.length_shared_secret))
	if C.OQS_KEM_decaps(k, u8(ss), u8(ciphertext), u8(privateKey)) != C.OQS_SUCCESS {
		return nil, fmt.Errorf("kem/liboqs: decapsulate failed for %q", s.method)
	}
	return ss, nil
}
