CREATE TABLE next_history_v2 (
  position INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES next_conversations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('transcripts','responses','captures')),
  segment_id TEXT,
  data TEXT NOT NULL CHECK(json_valid(data)),
  UNIQUE(kind,id),
  UNIQUE(conversation_id,segment_id)
);
INSERT INTO next_history_v2 SELECT * FROM next_history;
DROP TABLE next_history;
ALTER TABLE next_history_v2 RENAME TO next_history;
CREATE INDEX next_history_conversation_order ON next_history(conversation_id,kind,position);
