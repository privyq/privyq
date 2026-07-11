-- audit_events: queryable, denormalised index of access events (ARCH §12.1).
-- Runtime schema lives in internal/storage/schema.sql; this mirrors it for the
-- migration record. (v2: closes gap B4.)
CREATE TABLE IF NOT EXISTS audit_events (
    id          BIGSERIAL PRIMARY KEY,
    resource_id TEXT,
    actor_id    TEXT,
    action      TEXT NOT NULL,
    status      TEXT NOT NULL,
    evidence_id TEXT NOT NULL,
    timestamp   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events (resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_time ON audit_events (timestamp);
