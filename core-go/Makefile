# PrivyQ cryptographic core — build & test.
BINARY := privyqd
PKG    := ./...

.PHONY: all build test cover vet proto run clean tidy

all: vet test build

build: ## Build the privyqd daemon
	go build -o bin/$(BINARY) ./cmd/privyqd

run: build ## Build and run the daemon
	./bin/$(BINARY)

test: ## Run unit tests
	go test $(PKG)

cover: ## Run tests with coverage report
	go test -coverprofile=coverage.out $(PKG)
	go tool cover -func=coverage.out | tail -1

vet: ## Static analysis
	go vet $(PKG)

tidy: ## Sync go.mod/go.sum
	go mod tidy

# Regenerate Go stubs from the protobuf contract. Requires protoc,
# protoc-gen-go and protoc-gen-go-grpc on PATH.
proto: ## Regenerate gRPC stubs from pkg/proto/privyq.proto
	protoc --go_out=. --go_opt=module=github.com/privyq/privyq/core-go \
	       --go-grpc_out=. --go-grpc_opt=module=github.com/privyq/privyq/core-go \
	       --proto_path=pkg/proto pkg/proto/privyq.proto

clean:
	rm -rf bin coverage.out
