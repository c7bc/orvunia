CREATE TABLE repository_agent_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES next_conversations(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  UNIQUE(workspace_id, actor_id, session_id, request_id)
);
CREATE TABLE repository_agent_usage (
  workspace_id TEXT NOT NULL REFERENCES next_workspaces(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  turn INTEGER NOT NULL,
  state TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY(workspace_id, actor_id, session_id, job_id, turn)
);
