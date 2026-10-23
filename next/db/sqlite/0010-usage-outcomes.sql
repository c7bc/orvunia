ALTER TABLE next_usage_settlements ADD COLUMN action TEXT NOT NULL DEFAULT 'commit' CHECK(action IN ('commit','release'));
