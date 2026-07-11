package keymanager

import (
	"strings"
	"testing"
)

func TestNewKeyStorageDispatch(t *testing.T) {
	if s, err := NewKeyStorage(Config{Backend: "memory"}); err != nil || s == nil {
		t.Fatalf("memory backend: %v", err)
	}
	if s, err := NewKeyStorage(Config{Backend: "local", Path: t.TempDir(), Password: "pw"}); err != nil || s == nil {
		t.Fatalf("local backend: %v", err)
	}
	// Empty defaults to local.
	if _, err := NewKeyStorage(Config{Path: t.TempDir()}); err != nil {
		t.Fatalf("empty backend should default to local: %v", err)
	}
}

func TestNewKeyStorageDocumentedButUnavailable(t *testing.T) {
	for _, backend := range []string{"hsm", "aws-kms", "azure-kms"} {
		_, err := NewKeyStorage(Config{Backend: backend})
		if err == nil {
			t.Fatalf("%s: expected a clear error while the backend is not enabled", backend)
		}
		// The message must be actionable, not a bare "not supported".
		if !strings.Contains(err.Error(), backend) || !strings.Contains(err.Error(), "local") {
			t.Fatalf("%s: error should name the backend and point to a fallback, got: %v", backend, err)
		}
	}
}

func TestNewKeyStorageUnknown(t *testing.T) {
	_, err := NewKeyStorage(Config{Backend: "banana"})
	if err == nil || !strings.Contains(err.Error(), "unknown") {
		t.Fatalf("unknown backend should error clearly, got: %v", err)
	}
}
