CREATE TABLE next_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  request_key TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  hash TEXT NOT NULL,
  bytes INTEGER NOT NULL CHECK(bytes > 0),
  mime TEXT NOT NULL,
  title TEXT NOT NULL,
  time TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('staged','ready','deleting','deleted')),
  created_at INTEGER NOT NULL,
  UNIQUE(workspace_id,request_key)
);
CREATE INDEX next_assets_collection ON next_assets(workspace_id,conversation_id,state);
CREATE INDEX next_assets_cleanup ON next_assets(state,created_at);
