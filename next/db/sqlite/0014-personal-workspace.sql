CREATE TABLE next_personal_workspaces(seed TEXT PRIMARY KEY,workspace_id TEXT NOT NULL UNIQUE);
CREATE TABLE next_deleted_workspaces(workspace_id TEXT PRIMARY KEY,deleted_at INTEGER NOT NULL);
CREATE TRIGGER next_workspace_live_insert BEFORE INSERT ON next_workspaces
WHEN EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_workspace_live_update BEFORE UPDATE ON next_workspaces
WHEN EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_conversation_live_insert BEFORE INSERT ON next_conversations
WHEN EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_conversation_live_update BEFORE UPDATE ON next_conversations
WHEN EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_calendar_live_insert BEFORE INSERT ON next_calendars
WHEN EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_calendar_live_update BEFORE UPDATE ON next_calendars
WHEN EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_history_live_insert BEFORE INSERT ON next_history
WHEN EXISTS(SELECT 1 FROM next_conversations c JOIN next_deleted_workspaces d ON d.workspace_id=c.workspace_id WHERE c.id=NEW.conversation_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_history_live_update BEFORE UPDATE ON next_history
WHEN EXISTS(SELECT 1 FROM next_conversations c JOIN next_deleted_workspaces d ON d.workspace_id=c.workspace_id WHERE c.id=NEW.conversation_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_asset_live_insert BEFORE INSERT ON next_assets
WHEN NEW.state IN ('staged','ready') AND EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_asset_live_update BEFORE UPDATE ON next_assets
WHEN NEW.state IN ('staged','ready') AND EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_operation_live_insert BEFORE INSERT ON next_operations
WHEN NEW.state IN ('prepared','running') AND EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_operation_live_update BEFORE UPDATE ON next_operations
WHEN NEW.state IN ('prepared','running') AND EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_usage_live_insert BEFORE INSERT ON next_usage
WHEN NEW.state='reserved' AND EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_usage_live_update BEFORE UPDATE ON next_usage
WHEN NEW.state='reserved' AND EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_followup_draft_live_insert BEFORE INSERT ON next_followup_drafts
WHEN EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_followup_draft_live_update BEFORE UPDATE ON next_followup_drafts
WHEN EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_followup_delivery_live_insert BEFORE INSERT ON next_followup_deliveries
WHEN NEW.state IN ('pending','queued','processing') AND EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

CREATE TRIGGER next_followup_delivery_live_update BEFORE UPDATE ON next_followup_deliveries
WHEN NEW.state IN ('pending','queued','processing') AND EXISTS(SELECT 1 FROM next_deleted_workspaces WHERE workspace_id=NEW.workspace_id)
BEGIN
  SELECT RAISE(ABORT,'cadence_deleted_workspace');
END;

