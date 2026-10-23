CREATE TABLE next_legacy_uploads(
 workspace_id TEXT NOT NULL,request_key TEXT NOT NULL,
 conversation_id TEXT NOT NULL REFERENCES next_conversations(id) ON DELETE CASCADE,
 capture_id TEXT NOT NULL,payload_hash TEXT NOT NULL,
 PRIMARY KEY(workspace_id,request_key)
);
CREATE TRIGGER next_legacy_transcript_removed AFTER DELETE ON next_history
WHEN OLD.kind='transcripts' AND OLD.segment_id IS NOT NULL
BEGIN
 DELETE FROM next_legacy_segments WHERE conversation_id=OLD.conversation_id
 AND segment_id=OLD.segment_id AND json_extract(result,'$.id')=OLD.id;
END;
CREATE TABLE next_legacy_segments(
 workspace_id TEXT NOT NULL,
 conversation_id TEXT NOT NULL REFERENCES next_conversations(id) ON DELETE CASCADE,
 segment_id TEXT NOT NULL,result TEXT NOT NULL CHECK(json_valid(result)),
 PRIMARY KEY(workspace_id,conversation_id,segment_id)
);
