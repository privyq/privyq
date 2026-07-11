package keymanager

import "fmt"

// Config selects and configures a key-storage backend (ARCH §13.3, §20.1).
type Config struct {
	Backend  string // memory | local | hsm | aws-kms | azure-kms
	Path     string // local: directory for encrypted key files
	Password string // local: master password (stretched to the file-encryption key)

	// KMS/HSM options (used by the respective backends when enabled).
	KMSKeyID  string // aws-kms / azure-kms: the wrapping-key id/URI
	Region    string // aws-kms: region
	HSMModule string // hsm: path to the PKCS#11 module (.so)
	HSMPin    string // hsm: token PIN
	HSMLabel  string // hsm: token/key label
}

// kmsBackendFactory builds a KMS/HSM-backed KeyStorage. Real implementations
// register themselves here (some behind build tags / requiring credentials);
// when none is registered for a backend, NewKeyStorage returns a clear,
// actionable error instead of crashing (closes v1 gap B3).
var kmsBackendFactory = map[string]func(Config) (KeyStorage, error){}

func registerKMSBackend(name string, f func(Config) (KeyStorage, error)) {
	kmsBackendFactory[name] = f
}

// NewKeyStorage constructs the KeyStorage for cfg.Backend. Unknown backends and
// documented-but-unavailable backends both return a clear error — the daemon
// never dies with a confusing "not supported in v1.0" message.
func NewKeyStorage(cfg Config) (KeyStorage, error) {
	switch cfg.Backend {
	case "", "local":
		return NewLocalFileStore(cfg.Path, cfg.Password)
	case "memory":
		return NewMemoryStore(), nil
	case "hsm", "aws-kms", "azure-kms":
		if f, ok := kmsBackendFactory[cfg.Backend]; ok {
			return f(cfg)
		}
		return nil, fmt.Errorf(
			"keymanager: KEY_STORAGE=%q is a supported backend but is not enabled in this build/configuration "+
				"(it needs its credentials/module and, for HSM, a CGO build); see core-go/README. "+
				"Use KEY_STORAGE=memory or local otherwise", cfg.Backend)
	default:
		return nil, fmt.Errorf("keymanager: unknown KEY_STORAGE=%q (valid: memory, local, hsm, aws-kms, azure-kms)", cfg.Backend)
	}
}
