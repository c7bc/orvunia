ALTER TABLE next_conversations ADD COLUMN search_title TEXT NOT NULL DEFAULT '';
ALTER TABLE next_history ADD COLUMN search_text TEXT NOT NULL DEFAULT '';
CREATE INDEX next_history_search_session ON next_history(conversation_id, kind);
