-- QA-only installation identity and initial admin invitation. Never apply to legacy production.
CREATE TABLE IF NOT EXISTS nexora_initial_access (
 installation_id TEXT PRIMARY KEY,
 username TEXT NOT NULL,
 invite_hash TEXT NOT NULL UNIQUE CHECK(length(invite_hash)=64),
 expires_at INTEGER NOT NULL,
 consumed_at INTEGER,
 CHECK(consumed_at IS NULL OR consumed_at <= expires_at)
) STRICT;
