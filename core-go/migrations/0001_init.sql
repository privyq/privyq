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
