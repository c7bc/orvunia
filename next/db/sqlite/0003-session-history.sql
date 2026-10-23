CREATE TABLE next_conversations_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('recruiter', 'technical')),
  state TEXT NOT NULL CHECK(state IN ('active', 'paused', 'ended')),
  created_at TEXT NOT NULL,
  elapsed INTEGER NOT NULL DEFAULT 0 CHECK(elapsed >= 0),
  question TEXT NOT NULL DEFAULT '',
  mode_snapshot TEXT CHECK(mode_snapshot IS NULL OR json_valid(mode_snapshot)),
  history_generation INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0
);
INSERT INTO next_conversations_v2(id,workspace_id,title,mode,state,created_at)
SELECT id,workspace_id,title,mode,state,created_at FROM next_conversations;
CREATE TABLE next_notes_v2 (
  conversation_id TEXT PRIMARY KEY NOT NULL REFERENCES next_conversations_v2(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 0),
  updated_at TEXT
);
INSERT INTO next_notes_v2 SELECT * FROM next_notes;
DROP TABLE next_notes;
DROP TABLE next_conversations;
ALTER TABLE next_conversations_v2 RENAME TO next_conversations;
ALTER TABLE next_notes_v2 RENAME TO next_notes;
CREATE INDEX next_conversations_workspace_order ON next_conversations(workspace_id,created_at,id);
CREATE TABLE next_history (
  position INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  conversation_id TEXT NOT NULL REFERENCES next_conversations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('transcripts','responses','captures')),
  segment_id TEXT,
  data TEXT NOT NULL CHECK(json_valid(data)),
  UNIQUE(conversation_id,segment_id)
);
CREATE INDEX next_history_conversation_order ON next_history(conversation_id,kind,position);
