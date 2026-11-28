-- Only the two fictitious QA installations. The server compares this marker with its fixed environment binding.
CREATE TABLE IF NOT EXISTS nexora_installation_identity (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 installation_id TEXT NOT NULL UNIQUE,
 environment TEXT NOT NULL CHECK(environment='qa')
) STRICT;
