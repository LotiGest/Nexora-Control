-- Exclusive private QA database, not a customer database.
CREATE TABLE IF NOT EXISTS provision_operations(
 contract_id TEXT PRIMARY KEY,
 revision TEXT NOT NULL CHECK(length(revision)=64),
 requested_by TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('running','schema-ready','review-required')),
 database_id TEXT UNIQUE,
 database_name TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 finished_at TEXT,
 CHECK(state!='schema-ready' OR (database_id IS NOT NULL AND database_name IS NOT NULL))
) STRICT;
