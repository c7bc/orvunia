CREATE TABLE next_billing_accounts (
 workspace_id TEXT PRIMARY KEY,
 plan_id TEXT NOT NULL DEFAULT 'free',
 status TEXT NOT NULL DEFAULT 'none',
 period_end INTEGER NOT NULL DEFAULT 0,
 customer_id TEXT UNIQUE,
 subscription_id TEXT UNIQUE
);
CREATE TABLE next_usage (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 request_key TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('answers','transcriptionSeconds')),
 period TEXT NOT NULL,
 units INTEGER NOT NULL CHECK(units > 0),
 actual INTEGER NOT NULL DEFAULT 0 CHECK(actual >= 0 AND actual <= units),
 state TEXT NOT NULL CHECK(state IN ('reserved','committed','released','unknown')),
 created_at INTEGER NOT NULL,
 lease_until INTEGER NOT NULL,
 measurement TEXT NOT NULL,
 UNIQUE(workspace_id,request_key,kind)
);
CREATE INDEX next_usage_workspace_period ON next_usage(workspace_id,period,kind,state);
CREATE INDEX next_usage_global_period ON next_usage(period,kind,state);
