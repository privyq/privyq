-- PrivyQ database schema (ARCH §12.1).
-- Applied automatically by the core on startup when DB_URL is set.

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL,
    role          TEXT,
    department    TEXT,
    organization  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS keys (
    id            TEXT PRIMARY KEY,
    version       TEXT NOT NULL,
    algorithm     TEXT NOT NULL,
    key_type      TEXT NOT NULL,               -- encryption | signing
    public_key    TEXT NOT NULL,               -- base64
    private_key   BYTEA NOT NULL,              -- encrypted at rest
    status        TEXT NOT NULL,               -- active | rotated | revoked | expired | archived
    owner         TEXT,
    organization  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ,
    rotated_at    TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    metadata      JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_keys_owner ON keys (owner);
CREATE INDEX IF NOT EXISTS idx_keys_status ON keys (status);

CREATE TABLE IF NOT EXISTS policies (
    id            BIGSERIAL PRIMARY KEY,
    policy_hash   TEXT UNIQUE NOT NULL,
    policy_json   JSONB NOT NULL,
    created_by    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resources (
    id            TEXT PRIMARY KEY,
    resource_hash TEXT NOT NULL,
    policy_hash   TEXT REFERENCES policies (policy_hash),
    owner         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resources_policy ON resources (policy_hash);

-- The append-only, hash-chained audit evidence log (ARCH §15).
CREATE TABLE IF NOT EXISTS evidence_log (
    position      BIGINT PRIMARY KEY,          -- 0-based chain index
    evidence_id   TEXT UNIQUE NOT NULL,
    timestamp     TIMESTAMPTZ NOT NULL,
    actor_id      TEXT,
    resource_id   TEXT,
    resource_hash TEXT,
    operation     TEXT NOT NULL,               -- protect | access
    result        TEXT NOT NULL,               -- granted | denied
    signature     TEXT NOT NULL,
    public_key_id TEXT,
    parent_hash   TEXT NOT NULL,
    entry_hash    TEXT NOT NULL,               -- SHA-256 of the full entry (next entry's parent)
    body          JSONB NOT NULL,              -- full serialized evidence
    verified      BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_evidence_resource ON evidence_log (resource_hash);
CREATE INDEX IF NOT EXISTS idx_evidence_actor ON evidence_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_evidence_time ON evidence_log (timestamp);

-- audit_events: a queryable, denormalised index of access events (ARCH §12.1).
-- The authoritative record is the signed evidence_log chain; this table makes
-- "who did what to which resource, and was it allowed" cheap to query and report.
-- (v2: closes gap B4 — the table was specified but never created.)
CREATE TABLE IF NOT EXISTS audit_events (
    id          BIGSERIAL PRIMARY KEY,
    resource_id TEXT,
    actor_id    TEXT,
    action      TEXT NOT NULL,                -- protect | access | check
    status      TEXT NOT NULL,                -- granted | denied
    evidence_id TEXT NOT NULL,                -- links back to evidence_log
    timestamp   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events (resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_time ON audit_events (timestamp);

-- tenants: multi-tenancy foundation (v2 blueprint §19). A single deployment can
-- serve many organisations. Core tables carry a tenant_id (default 'default');
-- gateway credentials bind a request to its tenant, and per-request scoping is
-- enforced there.
CREATE TABLE IF NOT EXISTS tenants (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    settings    JSONB NOT NULL DEFAULT '{}'
);
INSERT INTO tenants (id, name) VALUES ('default', 'Default Tenant') ON CONFLICT (id) DO NOTHING;

-- Tenant scoping columns on the core tables (safe to run on existing DBs).
ALTER TABLE users     ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE keys      ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_keys_tenant ON keys (tenant_id);
CREATE INDEX IF NOT EXISTS idx_resources_tenant ON resources (tenant_id);
