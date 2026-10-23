CREATE TABLE next_conversations (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('recruiter', 'technical')),
  state TEXT NOT NULL CHECK(state IN ('active', 'ended')),
  created_at TEXT NOT NULL
);
CREATE INDEX next_conversations_workspace_order ON next_conversations(workspace_id, created_at, id);
CREATE TABLE next_notes (
  conversation_id TEXT PRIMARY KEY NOT NULL REFERENCES next_conversations(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 0),
  updated_at TEXT
);
