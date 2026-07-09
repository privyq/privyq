// Command privyqd is the PrivyQ cryptographic core daemon. It starts a gRPC
// server exposing the PrivyQCore service (ARCH §7). Configuration is via
// environment variables (ARCH §20.1).
package main

import (
	"context"
	"crypto/tls"
	"log"
	"net"
	"os"

	coregrpc "github.com/privyq/privyq/core-go/internal/grpc"

	"github.com/privyq/privyq/core-go/internal/audit"
	"github.com/privyq/privyq/core-go/internal/core"
	"github.com/privyq/privyq/core-go/internal/keymanager"
	"github.com/privyq/privyq/core-go/internal/storage"
	"github.com/privyq/privyq/core-go/pkg/pb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/reflection"
)

const version = "1.0.0"

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	port := env("GRPC_PORT", "50051")
	keyStorage := env("KEY_STORAGE", "local")
	keyPath := env("KEY_STORAGE_PATH", "./data/keys")
	masterPw := env("KEY_MASTER_PASSWORD", "privyq-dev-master")

	// Select the key storage backend (ARCH §13.3). HSM/cloud-KMS backends
	// implement the same interface and slot in here.
	var store keymanager.KeyStorage
	var evidence audit.EvidenceStore = audit.NewMemoryEvidenceStore()

	// When DB_URL is set, use PostgreSQL for both keys and the evidence chain
	// so they survive restarts (ARCH §12). Otherwise fall back to local/memory.
	if dbURL := os.Getenv("DB_URL"); dbURL != "" && os.Getenv("AUDIT_STORAGE") != "file" {
		pg, err := storage.New(context.Background(), dbURL)
		if err != nil {
			log.Fatalf("privyqd: postgres: %v", err)
		}
		defer pg.Close()
		store = pg.Keys()
		evidence = pg.Evidence()
		log.Printf("privyqd: using PostgreSQL persistence")
	} else {
		switch keyStorage {
		case "memory":
			store = keymanager.NewMemoryStore()
		case "local":
			var err error
			if store, err = keymanager.NewLocalFileStore(keyPath, masterPw); err != nil {
				log.Fatalf("privyqd: key storage: %v", err)
			}
		default:
			log.Fatalf("privyqd: KEY_STORAGE=%q not supported in v1.0 (use memory|local)", keyStorage)
		}
	}

	svc := core.New(keymanager.New(store), evidence, version)
	server := coregrpc.NewServer(svc)

	opts := []grpc.ServerOption{}
	if cert, key := os.Getenv("TLS_CERT"), os.Getenv("TLS_KEY"); cert != "" && key != "" {
		tlsCert, err := tls.LoadX509KeyPair(cert, key)
		if err != nil {
			log.Fatalf("privyqd: tls: %v", err)
		}
		opts = append(opts, grpc.Creds(credentials.NewServerTLSFromCert(&tlsCert)))
		log.Printf("privyqd: TLS enabled")
	}

	grpcServer := grpc.NewServer(opts...)
	pb.RegisterPrivyQCoreServer(grpcServer, server)
	reflection.Register(grpcServer) // enables grpcurl for manual testing

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("privyqd: listen: %v", err)
	}
	log.Printf("privyqd %s listening on :%s (key storage: %s)", version, port, keyStorage)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("privyqd: serve: %v", err)
	}
}
