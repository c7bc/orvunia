CREATE TABLE next_followup_drafts (
 workspace_id TEXT NOT NULL,
 conversation_id TEXT NOT NULL REFERENCES next_conversations(id) ON DELETE CASCADE,
 recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
 revision INTEGER NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(workspace_id,conversation_id)
);
CREATE TABLE next_followup_deliveries (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
 conversation_id TEXT NOT NULL REFERENCES next_conversations(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, request_id TEXT NOT NULL, draft_hash TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','queued','processing','completed','failed','unknown','expired')),
 provider_id TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
 ciphertext TEXT NOT NULL, expires_at INTEGER NOT NULL, claimed_at INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0, retry_at INTEGER NOT NULL DEFAULT 0,
 UNIQUE(workspace_id,request_id), UNIQUE(workspace_id,conversation_id,revision)
);
CREATE INDEX next_followup_pending ON next_followup_deliveries(state,retry_at,created_at);
CREATE TABLE next_followup_attempts(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX next_followup_daily ON next_followup_attempts(workspace_id,created_at);

CREATE TABLE next_followup_requests(workspace_id TEXT NOT NULL,request_id TEXT NOT NULL,delivery_id TEXT NOT NULL REFERENCES next_followup_deliveries(id) ON DELETE CASCADE,PRIMARY KEY(workspace_id,request_id));
