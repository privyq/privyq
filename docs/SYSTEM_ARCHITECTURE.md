# PrivyQ — System Architecture Specification v1.0

**Project:** PrivyQ  
**Purpose:** Technical architecture for implementation  
**Companion Document:** `BLUEPRINT.md`  
**Version:** 1.0.0  

---

# Table of Contents

1. Introduction
2. Architectural Philosophy
3. System Overview
4. High-Level Architecture
5. Repository Structure
6. Core Service Breakdown
7. Go Cryptographic Core
8. gRPC Communication Layer
9. Python SDK Layer
10. FastAPI Gateway
11. Next.js Demonstration Platform
12. Database Design
13. Key Management System
14. Policy Decision Engine
15. Privacy Audit Log Engine
16. Data Flow Diagrams
17. Sequence Diagrams
18. Security Architecture
19. Deployment Architecture
20. Environment Configuration
21. Error Handling Strategy
22. Logging Strategy
23. Testing Architecture
24. Performance Considerations
25. Extensibility Model
26. Versioning Strategy
27. Development Workflow

---

# 1. Introduction

This document defines the **technical architecture of PrivyQ** as specified in the companion `BLUEPRINT.md`. Its goal is to provide a clear roadmap for implementing the cryptographic infrastructure, backend services, developer SDK, and demonstration interface.

The architecture prioritises:

- **modular design** – each component has a clear, single responsibility
- **strong separation of concerns** – cryptographic operations are isolated from application logic
- **developer accessibility** – simple, intention-based APIs hide cryptographic complexity
- **security isolation** – the cryptographic core runs as a separate service with minimal attack surface
- **enterprise readiness** – built-in key management, policy engines, and verifiable audit trails

---

# 2. Architectural Philosophy

PrivyQ follows five primary design principles.

## 2.1 Isolation of Cryptographic Operations

All cryptographic logic is contained within a dedicated Go core. This reduces risk, simplifies security auditing, and allows the core to be replaced or upgraded independently.

## 2.2 Layered Architecture

Each layer has a clearly defined responsibility and communicates with adjacent layers via well-defined interfaces (gRPC, REST, SDK calls). This enables independent development, testing, and deployment of each layer.

## 2.3 Developer Simplicity

Developers should not need to understand cryptographic primitives or policy internals. The SDK exposes intuitive functions such as `protect()`, `access()`, and `verify()` that hide complexity.

## 2.4 Privacy by Design

Privacy policies and auditability are integrated at the architecture level rather than added later. Every access decision is governed by a policy, and every access event generates cryptographically verifiable evidence.

## 2.5 Extensibility

The system is designed to be extensible: policy types, key management strategies, and audit backends can be added or replaced without affecting other layers.

---

# 3. System Overview

PrivyQ is composed of five main layers, each with a distinct role:

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend Layer                            │
│           Next.js Demonstration Platform                    │
│        (Interactive web interface for demonstrations)      │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTPS / REST
┌─────────────────────────────▼───────────────────────────────┐
│                   Application Layer                         │
│                    FastAPI Gateway                          │
│               (REST API for service integration)            │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTP / JSON (or internal gRPC)
┌─────────────────────────────▼───────────────────────────────┐
│                  Developer Layer                            │
│                    Python SDK                               │
│    (Intention-based API for application developers)        │
└─────────────────────────────┬───────────────────────────────┘
                              │ gRPC (internal)
┌─────────────────────────────▼───────────────────────────────┐
│                   Policy & Key Layer                        │
│     Policy Decision Engine + Key Management Service         │
│        (Contextual policy evaluation & key lifecycle)       │
└─────────────────────────────┬───────────────────────────────┘
                              │ Internal interfaces
┌─────────────────────────────▼───────────────────────────────┐
│                   Cryptographic Core Layer                  │
│             Go Cryptographic Engine                         │
│         (All PQC operations: Kyber, Dilithium, etc.)       │
└─────────────────────────────┬───────────────────────────────┘
                              │ CGO bindings
┌─────────────────────────────▼───────────────────────────────┐
│                   Library Layer                             │
│                     liboqs                                   │
│          (NIST PQC reference implementation)               │
└─────────────────────────────────────────────────────────────┘
```

---

# 4. High-Level Architecture

The complete system architecture with internal service boundaries is shown below:

```
                ┌────────────────────────────────────────────────────────────┐
                │                  Next.js Demonstration                    │
                │  (User Interface: upload, access, audit dashboard, keys) │
                └─────────────────────────┬──────────────────────────────────┘
                                          │ REST (HTTPS)
                ┌─────────────────────────▼──────────────────────────────────┐
                │                     FastAPI Gateway                       │
                │  - Endpoints: /protect, /access, /verify, /evidence/log   │
                │  - Authentication (JWT/API keys)                          │
                │  - Rate limiting                                          │
                │  - OpenAPI docs                                           │
                └─────────────────────────┬──────────────────────────────────┘
                                          │ SDK calls (internal HTTP or gRPC)
                ┌─────────────────────────▼──────────────────────────────────┐
                │                     Python SDK                            │
                │  - `protect()`, `access()`, `verify()`                   │
                │  - Policy and identity serialisation                     │
                │  - Error handling                                        │
                └─────────────────────────┬──────────────────────────────────┘
                                          │ gRPC (over localhost or internal)
                ┌─────────────────────────▼──────────────────────────────────┐
                │               Policy Decision Engine                     │
                │  - Policy validation                                     │
                │  - Context evaluation (role, department, purpose, etc.) │
                │  - Delegation checks                                     │
                └─────────────────────────┬──────────────────────────────────┘
                                          │
                ┌─────────────────────────▼──────────────────────────────────┐
                │               Key Management Service                     │
                │  - Generation, rotation, revocation, delegation          │
                │  - Key hierarchy (org → dept → user)                    │
                │  - Storage (local encrypted, HSM, cloud KMS)            │
                └─────────────────────────┬──────────────────────────────────┘
                                          │
                ┌─────────────────────────▼──────────────────────────────────┐
                │                 Go Cryptographic Core                    │
                │  - Kyber KEM (encapsulation/decapsulation)              │
                │  - AES-256-GCM symmetric encryption                     │
                │  - Dilithium signing/verification                       │
                │  - Audit evidence chaining                              │
                └─────────────────────────┬──────────────────────────────────┘
                                          │ CGO bindings
                ┌─────────────────────────▼──────────────────────────────────┐
                │                        liboqs                             │
                │  - Kyber, Dilithium, Falcon, SPHINCS+                   │
                └────────────────────────────────────────────────────────────┘
```

---

# 5. Repository Structure

Recommended repository layout for the complete system:

```
privyq/
│
├── docs/
│   ├── BLUEPRINT.md
│   ├── SYSTEM_ARCHITECTURE.md
│   └── api/
│       └── openapi.yaml
│
├── core-go/                           # Cryptographic core (Go)
│   ├── cmd/
│   │   └── privyqd/                   # Main daemon entry
│   ├── internal/
│   │   ├── kem/                       # Kyber KEM implementation
│   │   ├── signatures/                # Dilithium signing
│   │   ├── encryption/                # Hybrid encryption (AES + KEM)
│   │   ├── policies/                  # Policy validation logic
│   │   ├── audit/                     # Audit log generation & chaining
│   │   ├── keymanager/                # Key storage and lifecycle
│   │   └── grpc/                      # gRPC server definitions
│   ├── pkg/
│   │   └── types/                     # Shared types (protobuf definitions)
│   ├── go.mod
│   └── Makefile
│
├── sdk-python/                        # Python SDK
│   ├── privyq/
│   │   ├── __init__.py
│   │   ├── client.py                  # Core client (gRPC wrapper)
│   │   ├── protect.py                 # protect() function
│   │   ├── access.py                  # access() function
│   │   ├── verify.py                  # verify() function
│   │   ├── evidence.py                # evidence log retrieval
│   │   ├── keys.py                    # key management wrappers
│   │   ├── policies.py                # policy helper classes
│   │   ├── exceptions.py              # custom exceptions
│   │   └── config.py                  # configuration
│   ├── tests/
│   ├── setup.py
│   └── README.md
│
├── gateway/                           # FastAPI gateway
│   ├── app/
│   │   ├── main.py                    # FastAPI app creation
│   │   ├── routes/
│   │   │   ├── protect.py
│   │   │   ├── access.py
│   │   │   ├── verify.py
│   │   │   ├── evidence.py
│   │   │   └── keys.py
│   │   ├── services/
│   │   │   └── privyq_client.py       # wrapper around Python SDK
│   │   ├── schemas/                   # Pydantic models for API
│   │   ├── auth/                      # authentication (JWT, API keys)
│   │   └── middleware/                # logging, rate limiting
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                          # Next.js demo
│   ├── app/
│   │   ├── page.tsx                   # dashboard
│   │   ├── upload/                    # upload page
│   │   ├── access/                    # access request page
│   │   ├── audit/                     # audit evidence page
│   │   └── keys/                      # key management page
│   ├── components/                    # React components
│   │   ├── PolicyEditor.tsx
│   │   ├── EvidenceVerifier.tsx
│   │   └── ...
│   ├── services/
│   │   └── api.ts                     # HTTP client to gateway
│   ├── hooks/
│   ├── package.json
│   └── next.config.js
│
├── docker-compose.yml                 # local development environment
├── kubernetes/                        # production k8s manifests
│   ├── core-deployment.yaml
│   ├── gateway-deployment.yaml
│   └── frontend-deployment.yaml
└── tests/
    ├── integration/
    └── e2e/
```

---

# 6. Core Service Breakdown

| Component          | Language | Responsibility                                                                 |
| ------------------ | -------- | ------------------------------------------------------------------------------ |
| Cryptographic Core | Go       | All PQC operations: key generation, KEM, symmetric encryption, signing, audit chaining |
| Policy Engine      | Go       | Embedded in core – evaluates policies against identity/context; returns decision |
| Key Management     | Go       | Manages key lifecycle, hierarchy, storage, rotation, revocation, delegation    |
| Python SDK         | Python   | Intention-based API for developers; communicates with core via gRPC            |
| FastAPI Gateway    | Python   | REST API for remote integration; authentication, rate limiting, OpenAPI       |
| Next.js Frontend   | TypeScript | Demonstration platform; interactive UI for all major operations               |
| PostgreSQL         | SQL      | Persistent storage for keys (metadata), audit evidence, policies, user data   |

---

# 7. Go Cryptographic Core

The Go core is the only component that performs cryptographic operations. It is built as a gRPC server that receives requests and returns results.

## 7.1 Responsibilities

- **Key Generation** – generate Kyber key pairs (public/private) and Dilithium key pairs (for signing)
- **Hybrid Encryption** – encapsulate a symmetric key using Kyber, encrypt data with AES-256-GCM, and optionally sign with Dilithium
- **Hybrid Decryption** – decapsulate the symmetric key, decrypt data, verify signature (if present)
- **Policy Validation** – evaluate policy conditions against provided identity and context, returning a decision (grant/deny)
- **Audit Evidence Generation** – create a signed, chained evidence entry for every access event
- **Audit Evidence Verification** – verify signatures and chain integrity
- **Key Rotation & Revocation** – perform key lifecycle operations

## 7.2 Package Structure

```
core-go/
├── cmd/
│   └── privyqd/
│       └── main.go                     # entry point, start gRPC server
├── internal/
│   ├── kem/
│   │   ├── kyber.go                    # Kyber KEM wrapper (using liboqs)
│   │   └── kem_test.go
│   ├── signatures/
│   │   ├── dilithium.go               # Dilithium signature wrapper
│   │   └── signature_test.go
│   ├── encryption/
│   │   ├── hybrid.go                  # Hybrid encryption (KEM + AES-GCM)
│   │   └── hybrid_test.go
│   ├── policies/
│   │   ├── evaluator.go               # Policy evaluation logic
│   │   ├── conditions.go              # Condition types and operators
│   │   └── evaluator_test.go
│   ├── audit/
│   │   ├── evidence.go                # Evidence generation and chaining
│   │   ├── verifier.go                # Verification of evidence
│   │   └── audit_test.go
│   ├── keymanager/
│   │   ├── manager.go                 # Key lifecycle (generate, store, rotate, revoke)
│   │   ├── hierarchy.go               # Key hierarchy (org, dept, user)
│   │   └── storage.go                 # Storage backend (local, HSM, cloud)
│   └── grpc/
│       ├── server.go                  # gRPC server implementation
│       └── proto/                     # protobuf definitions
└── pkg/
    └── types/
        └── common.go                  # Shared types (e.g., Policy, Identity)
```

## 7.3 Core Interfaces (gRPC)

The core exposes a gRPC service with the following RPC methods:

```protobuf
service PrivyQCore {
    // Key management
    rpc GenerateKey (GenerateKeyRequest) returns (GenerateKeyResponse);
    rpc RotateKey (RotateKeyRequest) returns (RotateKeyResponse);
    rpc RevokeKey (RevokeKeyRequest) returns (RevokeKeyResponse);
    rpc GetPublicKey (GetPublicKeyRequest) returns (GetPublicKeyResponse);

    // Encryption/decryption
    rpc Protect (ProtectRequest) returns (ProtectResponse);
    rpc Access (AccessRequest) returns (AccessResponse);

    // Signatures
    rpc Sign (SignRequest) returns (SignResponse);
    rpc Verify (VerifyRequest) returns (VerifyResponse);

    // Audit
    rpc GenerateEvidence (GenerateEvidenceRequest) returns (GenerateEvidenceResponse);
    rpc VerifyEvidence (VerifyEvidenceRequest) returns (VerifyEvidenceResponse);
    rpc GetEvidenceLog (GetEvidenceLogRequest) returns (GetEvidenceLogResponse);
}
```

All messages are defined in `core-go/pkg/proto/privyq.proto`.

---

# 8. gRPC Communication Layer

The gRPC layer is the sole communication channel between the Python SDK and the Go core. It ensures high performance, strong typing, and language independence.

## 8.1 Protocol Definition

The protobuf schema defines all request/response structures. An excerpt:

```protobuf
message Policy {
    string version = 1;
    repeated Condition conditions = 2;
    string combination = 3; // "all", "any"
}

message Identity {
    string user_id = 1;
    string role = 2;
    string department = 3;
    string purpose = 4;
    string organization = 5;
    // additional context fields
}

message ProtectRequest {
    bytes plaintext = 1;
    Policy policy = 2;
    string algorithm = 3; // "kyber_768" by default
    string key_id = 4;    // optional
}

message ProtectResponse {
    bytes ciphertext = 1;
    bytes encrypted_key = 2;
    string key_id = 3;
    bytes signature = 4;
    Evidence evidence = 5;
}
```

## 8.2 Transport Security

All gRPC connections are secured with mTLS in production environments. In development, insecure connections are allowed for testing.

## 8.3 Connection Management

The SDK maintains a persistent connection pool to the core for performance. Connection health is monitored, and automatic reconnection is implemented.

---

# 9. Python SDK Layer

The Python SDK provides the primary interface for application developers.

## 9.1 Design Philosophy

- **Intention-based naming** – `protect()`, `access()`, `verify()` replace cryptographic jargon.
- **Type hints** – all functions are fully typed for IDE support.
- **Clear error handling** – custom exception classes for policy violations, cryptographic failures, and key errors.
- **Configuration simplicity** – minimal setup: `configure(core_address=...)`.

## 9.2 Core Functions

```python
from privyq import protect, access, verify, evidence, rotate_key, revoke_key, configure

# Configuration
configure(
    core_address="localhost:50051",
    default_algorithm="kyber_768",
    default_signature="dilithium_3",
    audit_enabled=True,
    verify_evidence=True
)

# Protection
protected = protect(
    data=b"Sensitive patient data",
    policy={
        "conditions": [
            {"type": "role", "operator": "equals", "value": "doctor"},
            {"type": "expiry", "operator": "before", "value": "2026-12-31"}
        ],
        "combination": "all"
    },
    key_id="key_123"  # optional
)

# Access
result = access(
    protected=protected,
    identity={
        "user_id": "doctor_123",
        "role": "doctor",
        "department": "cardiology"
    }
)
# result contains decrypted data and audit evidence

# Verification
verification_result = verify(evidence=result.evidence)

# Evidence log
log = evidence.log(resource_id="patient_001")
```

## 9.3 Exception Hierarchy

```
PrivyQError
├── PolicyViolationError
│   ├── ConditionFailedError
│   └── ExpiredError
├── KeyError
│   ├── KeyNotFoundError
│   ├── KeyRevokedError
│   └── KeyRotationError
├── CryptoError
│   ├── DecryptionFailedError
│   └── SignatureVerificationError
└── ConnectionError
    └── CoreUnreachableError
```

## 9.4 Configuration

The SDK can be configured via environment variables or a configuration file.

```python
from privyq import configure

configure(
    core_address=os.getenv("PRIVYQ_CORE_ADDRESS", "localhost:50051"),
    default_algorithm=os.getenv("PRIVYQ_ALGORITHM", "kyber_768"),
    default_signature=os.getenv("PRIVYQ_SIGNATURE", "dilithium_3"),
    timeout_seconds=int(os.getenv("PRIVYQ_TIMEOUT", "5")),
    audit_enabled=os.getenv("PRIVYQ_AUDIT", "true").lower() == "true",
)
```

---

# 10. FastAPI Gateway

The FastAPI gateway exposes RESTful endpoints for remote integration.

## 10.1 Endpoint Summary

| Method | Path                       | Description                                      |
|--------|----------------------------|--------------------------------------------------|
| POST   | `/api/v1/protect`          | Encrypt data with policy                         |
| POST   | `/api/v1/access`           | Decrypt data with identity                       |
| POST   | `/api/v1/verify`           | Verify an audit evidence entry                   |
| GET    | `/api/v1/evidence/log`     | Retrieve audit evidence for a resource           |
| POST   | `/api/v1/keys/generate`    | Generate a new key pair                          |
| POST   | `/api/v1/keys/rotate/{id}` | Rotate a key                                     |
| POST   | `/api/v1/keys/revoke/{id}` | Revoke a key                                     |
| GET    | `/api/v1/keys/{id}`        | Get public key information                       |
| GET    | `/api/v1/health`           | Service health check                             |
| GET    | `/docs`                    | OpenAPI documentation (auto-generated)           |

## 10.2 Authentication

The gateway supports:

- **API Key** – passed in `X-API-Key` header; suitable for service-to-service
- **JWT** – for user-based authentication (used by the demo frontend)

Authentication is implemented as middleware that validates tokens/keys and extracts the identity into the request context.

## 10.3 Rate Limiting

Rate limiting is applied per client IP or API key using a token bucket algorithm. Default limits are configurable.

## 10.4 Request/Response Validation

All requests are validated using Pydantic schemas to ensure required fields and correct types.

---

# 11. Next.js Demonstration Platform

The Next.js frontend provides an interactive demonstration of the complete system.

## 11.1 Technology Stack

- **Next.js 14+** – React framework with App Router
- **TypeScript** – type-safe frontend
- **Tailwind CSS** – styling
- **shadcn/ui** – accessible, customisable UI components
- **Recharts** – visualise audit data
- **React Hook Form** – form handling
- **Zod** – validation

## 11.2 Page Structure

| Route               | Description                                               |
|---------------------|-----------------------------------------------------------|
| `/`                 | Dashboard overview; summary of recent activity, key status |
| `/upload`           | Upload new patient record with policy editor              |
| `/records`          | List of protected records; search/filter                  |
| `/record/[id]`      | Detailed view of a record; request access                 |
| `/audit`            | Audit evidence log with verification tool                 |
| `/keys`             | Key management interface (generate, rotate, revoke)       |
| `/playground`       | Interactive policy testing tool                           |

## 11.3 Key UI Components

- **PolicyEditor** – JSON-like form with autocomplete for condition types and operators
- **EvidenceVerifier** – displays evidence entry and verification status (green/red)
- **AccessRequestCard** – shows policy and identity, result of access attempt
- **KeyStatusIndicator** – shows key validity, expiry, rotation history

## 11.4 API Client

The frontend communicates with the FastAPI gateway via a typed API client generated from OpenAPI specification using `openapi-typescript`.

---

# 12. Database Design

PostgreSQL is the recommended database for storing persistent data.

## 12.1 Schema Overview

```
┌──────────────────┐          ┌──────────────────┐
│      users       │          │      keys        │
├──────────────────┤          ├──────────────────┤
│ id (PK)          │◄─────────│ id (PK)          │
│ username         │          │ public_key       │
│ role             │          │ key_type (encrypt/sign) │
│ department       │          │ algorithm (kyber_768) │
│ organization     │          │ status (active/revoked/expired) │
│ created_at       │          │ owner_id (FK→users) │
└──────────────────┘          │ created_at       │
                              │ expires_at       │
└──────────────────┘

┌──────────────────┐          ┌──────────────────┐
│    policies      │          │  evidence_log    │
├──────────────────┤          ├──────────────────┤
│ id (PK)          │          │ id (PK)          │
│ policy_hash      │          │ evidence_id (UUID) │
│ policy_json      │          │ timestamp        │
│ created_by (FK)  │          │ actor_id (FK→users) │
└──────────────────┘          │ resource_hash    │
                              │ operation        │
                              │ result           │
                              │ signature        │
                              │ chain_parent     │
                              │ verified         │
                              └──────────────────┘

┌──────────────────┐          ┌──────────────────┐
│   resources      │          │  audit_events    │
├──────────────────┤          ├──────────────────┤
│ id (PK)          │          │ id (PK)          │
│ resource_hash    │          │ resource_id (FK) │
│ policy_id (FK)   │          │ actor_id (FK)    │
│ owner_id (FK)    │          │ action (access/attempt) │
│ created_at       │          │ status (granted/denied) │
└──────────────────┘          │ evidence_id (FK→evidence_log) │
                              │ timestamp        │
                              └──────────────────┘
```

## 12.2 Indexing Strategy

- `evidence_log.resource_hash` – for fast lookup of evidence for a resource
- `evidence_log.actor_id` – for actor-based queries
- `evidence_log.timestamp` – for time-based queries
- `keys.owner_id` – for listing user keys
- `resources.policy_id` – for policy lookup

## 12.3 Data Retention

Audit evidence is retained for a configurable period (default: 7 years for compliance). Automated archival and deletion policies are implemented.

---

# 13. Key Management System

The Key Management System (KMS) is responsible for secure key lifecycle management.

## 13.1 Key Hierarchy

```
Master Key (HSM-backed)
├── Organization A
│   ├── Department: Cardiology
│   │   ├── User: Dr. Smith (signing key)
│   │   └── User: Dr. Jones (encryption key)
│   ├── Department: Oncology
│   │   └── ...
└── Organization B
    └── ...
```

Each key is identified by a UUID and has associated metadata: algorithm, purpose (encrypt/sign), owner, creation time, expiry, status.

## 13.2 Key Lifecycle States

```
┌────────┐      ┌────────┐      ┌─────────┐      ┌─────────┐
│Created │─────▶│ Active │─────▶│ Rotated │─────▶│ Revoked │
└────────┘      └────────┘      └─────────┘      └─────────┘
                    │                 │
                    ▼                 ▼
               ┌─────────┐      ┌─────────┐
               │Expired  │      │Archived │
               └─────────┘      └─────────┘
```

- **Created** – initial generation; not yet used.
- **Active** – available for encryption/decryption.
- **Rotated** – replaced by a newer key; old key kept for decryption of old data.
- **Revoked** – no longer usable; all operations denied.
- **Expired** – automatically transitioned after expiry date.
- **Archived** – stored for compliance but not usable.

## 13.3 Storage Backends

The KMS supports multiple storage backends:

- **Local encrypted storage** – keys encrypted with a master password, stored on disk (development/small-scale).
- **HSM integration** – using PKCS#11 for hardware security modules (production).
- **Cloud KMS** – AWS KMS, Azure Key Vault, or Google Cloud KMS.
- **Database** – keys stored in PostgreSQL (encrypted at rest) for high availability.

The storage backend is configurable via environment variables.

## 13.4 Delegation

Keys can be delegated to other users for a limited time and purpose. Delegation is recorded as a metadata attribute on the key and enforced by the Policy Engine.

---

# 14. Policy Decision Engine

The Policy Decision Engine (PDE) is embedded within the Go core and is responsible for evaluating policies against provided identities and context.

## 14.1 Policy Evaluation Flow

1. **Extract policy** from the `ProtectRequest` or from stored metadata.
2. **Extract identity** and **context** from the `AccessRequest` (identity fields, timestamp, location, etc.).
3. **Iterate over each condition** in the policy.
   - Match condition type (role, department, purpose, expiry, etc.)
   - Apply operator (equals, in, before, after, between, etc.)
   - Compare against identity/context values.
4. **Combine condition results** using the `combination` field:
   - `"all"` – all must be true → grant.
   - `"any"` – at least one true → grant.
5. **Return decision** (grant/deny) with a detailed reason.

## 14.2 Condition Registry

The PDE maintains a registry of condition types and their evaluators. New condition types can be added without changing core code.

```go
type ConditionEvaluator func(condition Condition, identity Identity, context Context) (bool, string)

// Example evaluator for "role"
func evaluateRole(condition Condition, identity Identity, context Context) (bool, string) {
    actual := identity.Role
    expected := condition.Value.(string)
    if condition.Operator == "equals" {
        return actual == expected, fmt.Sprintf("role %s matches expected %s", actual, expected)
    }
    // ... other operators
}
```

## 14.3 Policy Serialization

Policies are stored as JSON in the database and embedded in the ciphertext metadata. The Go core uses a struct representation for evaluation.

---

# 15. Privacy Audit Log Engine

The audit engine generates and verifies **cryptographically verifiable privacy evidence**.

## 15.1 Evidence Generation

On every successful access, the core generates an evidence entry:

1. Collect the following data:
   - Evidence ID (UUID)
   - Timestamp (RFC3339)
   - Actor identity (user_id, role, department)
   - Resource hash (SHA-256 of ciphertext)
   - Policy evaluation result (granted/denied)
   - Parent hash (SHA-256 of the previous evidence entry, or a genesis hash)
2. Serialize the evidence object to JSON.
3. Sign the JSON with the Dilithium private key of the actor (or a system signing key).
4. Store the signature and the serialised evidence in the database.
5. Return the evidence entry to the caller.

## 15.2 Chain Integrity

Each evidence entry contains the hash of the previous entry, forming an immutable chain.

```
[Genesis] ←── hash ── [Entry 1] ←── hash ── [Entry 2] ←── hash ── [Entry 3]
```

## 15.3 Verification

Verification of an evidence entry involves:

1. Fetch the evidence entry from the database.
2. Verify the Dilithium signature using the stored public key.
3. Compute the hash of the previous entry and compare with the `parent_hash` field.
4. Re-evaluate the policy (optional, for compliance) using the stored policy and identity.
5. If all checks pass, the evidence is considered verified.

## 15.4 Evidence Query API

The gateway provides endpoints to:

- Retrieve evidence for a specific resource.
- Retrieve evidence for a specific actor.
- Retrieve and verify the entire chain.
- Export evidence for compliance reporting.

---

# 16. Data Flow Diagrams

## 16.1 Encryption (Protect) Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  User   │───▶│Frontend │───▶│ Gateway │───▶│   SDK   │───▶│   Core  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
    │              │              │              │              │
    │ upload data  │              │              │              │
    │ with policy  │              │              │              │
    │──────────────▶              │              │              │
    │              │  REST /protect│              │              │
    │              │─────────────▶│              │              │
    │              │              │  protect()   │              │
    │              │              │─────────────▶│              │
    │              │              │              │  gRPC Protect │
    │              │              │              │─────────────▶│
    │              │              │              │              │
    │              │              │              │  1. Get Key  │
    │              │              │              │  2. KEM      │
    │              │              │              │  3. AES-256  │
    │              │              │              │  4. Sign     │
    │              │              │              │  5. Evidence │
    │              │              │              │              │
    │              │              │              │◀─ ProtectResp│
    │              │              │◀─ Protected │              │
    │              │◀─ Protected  │              │              │
    │◀─ Protected  │              │              │              │
    │  (display)   │              │              │              │
```

## 16.2 Decryption (Access) Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  User   │───▶│Frontend │───▶│ Gateway │───▶│   SDK   │───▶│   Core  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
    │              │              │              │              │
    │ select       │              │              │              │
    │ record       │              │              │              │
    │──────────────▶              │              │              │
    │              │  REST /access│              │              │
    │              │─────────────▶│              │              │
    │              │              │  access()    │              │
    │              │              │─────────────▶│              │
    │              │              │              │  gRPC Access │
    │              │              │              │─────────────▶│
    │              │              │              │              │
    │              │              │              │  1. Validate │
    │              │              │              │     policy   │
    │              │              │              │  2. Decaps.  │
    │              │              │              │  3. Decrypt  │
    │              │              │              │  4. Verify   │
    │              │              │              │  5. Evidence │
    │              │              │              │              │
    │              │              │              │◀─ AccessResp │
    │              │              │◀─ Decrypted  │              │
    │              │◀─ Decrypted  │              │              │
    │◀─ Decrypted  │              │              │              │
    │  (display)   │              │              │              │
```

---

# 17. Sequence Diagrams

## 17.1 Successful Access with Policy Evaluation

```
Client          Gateway         SDK            Core            DB
  │                │              │              │              │
  │ POST /access   │              │              │              │
  │───────────────▶│              │              │              │
  │                │  access()    │              │              │
  │                │─────────────▶│              │              │
  │                │              │ gRPC Access  │              │
  │                │              │─────────────▶│              │
  │                │              │              │ Get Key      │
  │                │              │              │─────────────▶│
  │                │              │              │◀─────────────│
  │                │              │              │ Evaluate     │
  │                │              │              │ policy       │
  │                │              │              │ (granted)    │
  │                │              │              │ Decrypt      │
  │                │              │              │ Gen Evidence │
  │                │              │              │ Store Evid.  │
  │                │              │              │─────────────▶│
  │                │              │              │◀─────────────│
  │                │              │◀─ Response   │              │
  │                │◀─ Response   │              │              │
  │◀─ Response     │              │              │              │
```

## 17.2 Denied Access (Policy Violation)

```
Client          Gateway         SDK            Core
  │                │              │              │
  │ POST /access   │              │              │
  │───────────────▶│              │              │
  │                │  access()    │              │
  │                │─────────────▶│              │
  │                │              │ gRPC Access  │
  │                │              │─────────────▶│
  │                │              │              │ Evaluate
  │                │              │              │ policy
  │                │              │              │ (denied)
  │                │              │◀─ Error      │
  │                │◀─ Error      │              │
  │◀─ Error (403)  │              │              │
```

---

# 18. Security Architecture

PrivyQ incorporates multiple layers of security.

## 18.1 Data-in-Transit

- **External (Frontend ↔ Gateway)** – TLS 1.3 (HTTPS)
- **Internal (Gateway ↔ SDK ↔ Core)** – mTLS for production; plaintext only in development
- **gRPC** – supports TLS and mTLS

## 18.2 Data-at-Rest

- **Keys** – stored encrypted using a master key (or HSM)
- **Audit Evidence** – stored in database with encryption at rest (transparent data encryption)
- **Policies** – stored as JSON; no sensitive data

## 18.3 Authentication & Authorisation

- **Gateway** – API key or JWT; identity extracted and passed to SDK/core
- **SDK** – does not perform authentication; trusts the gateway to provide identity
- **Core** – verifies identity fields; enforces policies

## 18.4 Cryptography

- **Hybrid encryption** – Kyber KEM + AES-256-GCM provides post-quantum confidentiality.
- **Signatures** – Dilithium provides authenticity and non-repudiation for audit evidence.
- **Randomness** – uses Go's `crypto/rand` and liboqs secure random.

## 18.5 Threat Mitigations

| Threat                            | Mitigation                                                                 |
|-----------------------------------|----------------------------------------------------------------------------|
| Quantum attacks on public keys    | Use Kyber/Dilithium; not vulnerable to Shor's algorithm                    |
| Policy bypass                     | Policy embedded in ciphertext; evaluated at decryption time                |
| Audit log tampering               | Cryptographic chaining and signatures prevent undetected modification      |
| Unauthorised access               | Policy enforcement + authentication (gateway)                              |
| Key compromise                    | Regular rotation; revocation; HSM integration                             |
| Denial of service                 | Rate limiting; connection pooling; resource limits                         |
| Insider threat                    | Audit logs provide evidence; policies restrict access                      |

---

# 19. Deployment Architecture

## 19.1 Local Development

A `docker-compose.yml` file sets up all services:

```yaml
version: '3.8'
services:
  privyq-core:
    build: ./core-go
    ports:
      - "50051:50051"
    volumes:
      - ./data/keys:/app/keys
      - ./data/audit:/app/audit
    environment:
      - GRPC_PORT=50051
      - DB_URL=postgres://postgres:pass@db:5432/privyq
      - KEY_STORAGE=local

  privyq-gateway:
    build: ./gateway
    ports:
      - "8000:8000"
    depends_on:
      - privyq-core
    environment:
      - CORE_ADDRESS=privyq-core:50051
      - SECRET_KEY=your-secret
      - AUTH_ENABLED=false

  privyq-frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - privyq-gateway
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=privyq
      - POSTGRES_PASSWORD=privyqpass
      - POSTGRES_DB=privyq
    volumes:
      - ./data/db:/var/lib/postgresql/data
```

## 19.2 Production (Kubernetes)

Each service is deployed as a separate deployment with multiple replicas for scalability.

```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: privyq-core
spec:
  replicas: 3
  selector:
    matchLabels:
      app: privyq-core
  template:
    metadata:
      labels:
        app: privyq-core
    spec:
      containers:
      - name: core
        image: privyq/core:latest
        ports:
        - containerPort: 50051
        env:
        - name: DB_URL
          valueFrom:
            secretKeyRef:
              name: privyq-secrets
              key: db-url
        - name: KEY_STORAGE
          value: "aws-kms"
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          grpc:
            port: 50051
          initialDelaySeconds: 10
        readinessProbe:
          grpc:
            port: 50051
          initialDelaySeconds: 5
```

## 19.3 Scalability Considerations

- **Core** – stateless; can be scaled horizontally (except for key storage, which must be shared)
- **Gateway** – stateless; easy to scale
- **Frontend** – static assets can be served via CDN; Next.js can be deployed as serverless functions
- **Database** – use read replicas for audit queries; connection pooling

---

# 20. Environment Configuration

Environment variables configure each service.

## 20.1 Go Core

| Variable               | Description                                   | Default           |
|------------------------|-----------------------------------------------|-------------------|
| `GRPC_PORT`            | gRPC server port                              | `50051`           |
| `DB_URL`               | PostgreSQL connection string                  | (required)        |
| `KEY_STORAGE`          | `local`, `hsm`, `aws-kms`, `azure-kms`       | `local`           |
| `KEY_STORAGE_PATH`     | Path for local key storage                    | `/app/keys`       |
| `AUDIT_STORAGE`        | `db` or `file`                                | `db`              |
| `LOG_LEVEL`            | `debug`, `info`, `warn`, `error`             | `info`            |
| `DEFAULT_ALGORITHM`    | `kyber_768`, `kyber_1024`, etc.               | `kyber_768`       |
| `DEFAULT_SIGNATURE`    | `dilithium_3`, `falcon_512`, etc.             | `dilithium_3`     |

## 20.2 FastAPI Gateway

| Variable               | Description                                   | Default           |
|------------------------|-----------------------------------------------|-------------------|
| `CORE_ADDRESS`         | gRPC address of the core                      | `localhost:50051` |
| `SECRET_KEY`           | JWT signing key                               | (required)        |
| `AUTH_ENABLED`         | Enable authentication                         | `true`            |
| `RATE_LIMIT_PER_SEC`   | Max requests per second per client            | `100`             |
| `RATE_LIMIT_BURST`     | Burst size                                    | `200`             |

## 20.3 Python SDK

| Variable               | Description                                   | Default           |
|------------------------|-----------------------------------------------|-------------------|
| `PRIVYQ_CORE_ADDRESS`  | gRPC address of the core                      | `localhost:50051` |
| `PRIVYQ_ALGORITHM`     | Default KEM algorithm                         | `kyber_768`       |
| `PRIVYQ_SIGNATURE`     | Default signature algorithm                   | `dilithium_3`     |
| `PRIVYQ_TIMEOUT`       | gRPC timeout (seconds)                        | `5`               |
| `PRIVYQ_AUDIT`         | Enable audit logging                          | `true`            |

---

# 21. Error Handling Strategy

Errors are categorised and returned with appropriate HTTP status codes and structured JSON bodies.

## 21.1 Error Response Format (HTTP)

```json
{
  "error": {
    "code": "POLICY_VIOLATION",
    "message": "Access denied: role condition failed",
    "details": {
      "condition": "role",
      "expected": "doctor",
      "actual": "nurse"
    },
    "timestamp": "2026-01-01T12:00:00Z"
  }
}
```

## 21.2 Error Codes

| Code                  | HTTP Status | Description                        |
|-----------------------|-------------|------------------------------------|
| `INVALID_REQUEST`     | 400         | Malformed request                  |
| `UNAUTHORIZED`        | 401         | Authentication required            |
| `FORBIDDEN`           | 403         | Policy violation / access denied   |
| `NOT_FOUND`           | 404         | Resource/key not found             |
| `CONFLICT`            | 409         | Key already exists, etc.           |
| `INTERNAL_ERROR`      | 500         | Cryptographic failure, DB error    |
| `RATE_LIMITED`        | 429         | Too many requests                  |

## 21.3 SDK Exception Mapping

The SDK maps gRPC status codes to Python exceptions:

- `grpc.StatusCode.PERMISSION_DENIED` → `PolicyViolationError`
- `grpc.StatusCode.NOT_FOUND` → `KeyNotFoundError`
- `grpc.StatusCode.ABORTED` → `KeyRevokedError`
- `grpc.StatusCode.DEADLINE_EXCEEDED` → `TimeoutError`
- `grpc.StatusCode.UNAVAILABLE` → `CoreUnreachableError`

---

# 22. Logging Strategy

## 22.1 Log Levels

- **DEBUG** – detailed cryptographic operation details (key generation, encapsulation)
- **INFO** – normal operations (protect, access success, key creation)
- **WARN** – policy violations, rate limiting, slow operations
- **ERROR** – cryptographic failures, database errors, service unavailability

## 22.2 Structured Logging

All logs are structured JSON for easy parsing and integration with log aggregators (ELK, Datadog).

```json
{
  "timestamp": "2026-01-01T12:00:00Z",
  "level": "info",
  "service": "core",
  "operation": "Access",
  "user_id": "doctor_123",
  "resource_hash": "a8fdc205...",
  "decision": "granted",
  "duration_ms": 15
}
```

## 22.3 Audit vs. System Logs

- **System logs** – operational logs (debug, info, warn, error)
- **Audit logs** – cryptographic evidence (stored in database, not in log files)

---

# 23. Testing Architecture

Testing covers multiple levels.

## 23.1 Unit Tests

- Go core: all internal packages (KEM, signatures, encryption, policies, audit)
- Python SDK: client, serialisation, error handling
- FastAPI: route handlers, authentication, middleware

**Tools:** `go test`, `pytest`, `unittest`

## 23.2 Integration Tests

- SDK ↔ Core gRPC communication
- Gateway ↔ SDK (mocked core)
- Database migrations and queries

**Tools:** `testcontainers` (for PostgreSQL), `pytest-integration`

## 23.3 End-to-End Tests

- Full flow: frontend → gateway → SDK → core → database
- Test scenarios: successful protect/access, policy denial, key rotation, audit verification

**Tools:** Playwright (for frontend), `pytest-e2e`

## 23.4 Performance Tests

- Load testing for core and gateway
- Measure latency and throughput at various concurrency levels

**Tools:** `k6`, `locust`

---

# 24. Performance Considerations

## 24.1 Optimisation Strategies

- **Go core** – compiled language, low latency; use CGO only for liboqs calls.
- **Concurrency** – gRPC server handles multiple requests concurrently; use goroutines.
- **Caching** – cache public keys in memory to avoid DB lookups.
- **Connection pooling** – SDK maintains persistent gRPC connections.
- **Asynchronous logging** – audit evidence writing to DB is asynchronous (buffered).

## 24.2 Bottlenecks & Mitigations

| Bottleneck               | Mitigation                                                  |
|--------------------------|-------------------------------------------------------------|
| liboqs operations        | Use optimised parameter sets; consider using assembly acceleration |
| Database writes (audit)  | Batch insert; use write-ahead logging; async writes         |
| Policy evaluation        | Simple policies evaluated quickly; complex policies cached  |
| Network latency          | Deploy core and gateway in same region; use gRPC keepalive  |

## 24.3 Benchmark Targets

- **Protect** (1KB data): < 15ms (p95)
- **Access** (1KB data, policy evaluation): < 20ms (p95)
- **Evidence verification** (single entry): < 5ms (p95)
- **Throughput**: 1000 requests/second per core instance

---

# 25. Extensibility Model

PrivyQ is designed to be easily extended.

## 25.1 Adding a New Policy Condition

1. Define the condition type in the policy schema.
2. Implement an evaluator function in `core-go/internal/policies/evaluator.go`.
3. Register the evaluator in the condition registry.

## 25.2 Adding a New KEM or Signature Algorithm

1. Ensure liboqs supports the algorithm.
2. Add wrapper in `core-go/internal/kem/` or `signatures/`.
3. Update configuration to allow selection.

## 25.3 Adding a New Key Storage Backend

1. Implement the `KeyStorage` interface in `core-go/internal/keymanager/storage.go`.
2. Add configuration to select the backend.

## 25.4 Adding New Language SDK

1. Generate gRPC client from protobuf.
2. Implement high-level wrappers mirroring the Python SDK.
3. Provide examples and documentation.

---

# 26. Versioning Strategy

## 26.1 Semantic Versioning

All components follow Semantic Versioning 2.0.0: `MAJOR.MINOR.PATCH`

- **MAJOR** – incompatible API changes
- **MINOR** – new functionality (backward-compatible)
- **PATCH** – bug fixes, performance improvements

## 26.2 Version Alignment

The core, SDK, and gateway are versioned together for simplicity (e.g., all v1.0.0). Future releases may decouple if needed.

## 26.3 Backward Compatibility

- Protocol buffer messages maintain backward compatibility for at least one major version.
- REST API endpoints are versioned (`/api/v1/...`).
- Python SDK functions maintain compatibility with older cores.

---

# 27. Development Workflow

## 27.1 Recommended Development Order

1. **Core** – implement cryptographic operations, gRPC server, basic policy evaluation.
2. **SDK** – build the Python client, high-level functions, error handling.
3. **Gateway** – REST endpoints, authentication, rate limiting.
4. **Frontend** – interactive demo, integrate with gateway.
5. **Database** – set up schema, implement storage layers.
6. **Integration** – end-to-end testing, performance tuning.

## 27.2 Contribution Guidelines

- All code must have unit tests.
- Go code must be formatted with `gofmt` and pass `golint`.
- Python code must pass `black` and `pylint`.
- Commit messages follow conventional commits.
- Pull requests require at least one review.

## 27.3 CI/CD Pipeline

GitHub Actions (or GitLab CI) will:

1. Run unit tests for all components.
2. Run integration tests.
3. Build Docker images.
4. Run security scanning (SAST, dependency scanning).
5. Deploy to staging environment on merge to main.

---

# Final Note

This architecture specification, together with the `BLUEPRINT.md`, forms the complete intellectual and technical foundation of the PrivyQ system.

The architecture ensures that the research contributions—policy-governed post‑quantum encryption, verifiable privacy evidence, and developer-centric tooling—are implemented in a robust, extensible, and production-ready manner.

---

**End of System Architecture Specification v1.0**