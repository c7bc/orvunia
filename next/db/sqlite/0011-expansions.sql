CREATE TABLE next_expansions (
 source_id TEXT PRIMARY KEY,
 source_kind TEXT NOT NULL DEFAULT 'responses' CHECK(source_kind='responses'),
 workspace_id TEXT NOT NULL,
 conversation_id TEXT NOT NULL REFERENCES next_conversations(id) ON DELETE CASCADE,
 request_id TEXT NOT NULL UNIQUE,
 expires_at INTEGER NOT NULL,
 revealed INTEGER NOT NULL DEFAULT 0,
 cancelled INTEGER NOT NULL DEFAULT 0,
 context_source TEXT NOT NULL CHECK(context_source IN ('original-snapshot','saved-answer-only')),
 FOREIGN KEY(source_kind,source_id) REFERENCES next_history(kind,id) ON DELETE CASCADE
);
CREATE INDEX next_expansions_owner ON next_expansions(workspace_id,conversation_id);
