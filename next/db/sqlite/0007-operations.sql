CREATE TABLE next_operations (
 id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('answer','transcription','expansion','followup')),
 workspace_id TEXT NOT NULL,
 conversation_id TEXT NOT NULL REFERENCES next_conversations(id) ON DELETE CASCADE,
 request_hash TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('prepared','running','completed','failed','cancelled','unknown','expired')),
 attempt INTEGER NOT NULL CHECK(attempt > 0),
 snapshot TEXT,
 snapshot_bytes INTEGER NOT NULL,
 result TEXT,
 lease TEXT NOT NULL,
 lease_until INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 cancel_requested INTEGER NOT NULL DEFAULT 0,
 provider_started INTEGER NOT NULL DEFAULT 0,
 partial INTEGER NOT NULL DEFAULT 0,
 reservation_id TEXT,
 PRIMARY KEY(kind,id)
);
CREATE INDEX next_operations_concurrency ON next_operations(workspace_id,state,lease_until,kind);
CREATE INDEX next_operations_context ON next_operations(workspace_id,expires_at);
CREATE TABLE next_asset_references (
 operation_kind TEXT NOT NULL,
 operation_id TEXT NOT NULL,
 asset_id TEXT NOT NULL REFERENCES next_assets(id),
 expires_at INTEGER NOT NULL,
 PRIMARY KEY(operation_kind,operation_id,asset_id),
 FOREIGN KEY(operation_kind,operation_id) REFERENCES next_operations(kind,id) ON DELETE CASCADE
);
CREATE INDEX next_asset_references_cleanup ON next_asset_references(asset_id,expires_at);
