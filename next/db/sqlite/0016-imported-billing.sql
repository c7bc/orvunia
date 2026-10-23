CREATE TABLE next_payments(
 workspace_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data))
);
CREATE TABLE next_billing_events(
 id TEXT PRIMARY KEY,subscription_id TEXT,created_at INTEGER NOT NULL,
 state TEXT NOT NULL,token TEXT,lease_until INTEGER NOT NULL,
 retry_at INTEGER NOT NULL,attempts INTEGER NOT NULL
);
