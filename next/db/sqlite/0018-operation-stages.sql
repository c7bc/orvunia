CREATE UNIQUE INDEX next_operation_workspace_identity
ON next_operations(kind, id, workspace_id);
CREATE TABLE next_operation_stages (
  workspace_id TEXT NOT NULL,
  operation_kind TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('running', 'completed', 'failed', 'unknown')),
  lease TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  result TEXT,
  PRIMARY KEY(workspace_id, operation_kind, operation_id, stage_id),
  FOREIGN KEY(operation_kind, operation_id, workspace_id)
    REFERENCES next_operations(kind, id, workspace_id) ON DELETE CASCADE,
  CHECK(result IS NULL OR length(CAST(result AS BLOB)) <= 34816)
);
CREATE INDEX next_operation_stages_expiry ON next_operation_stages(expires_at);
