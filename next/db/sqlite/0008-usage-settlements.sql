CREATE TABLE next_usage_settlements (
  reservation_id TEXT PRIMARY KEY REFERENCES next_usage(id),
  workspace_id TEXT NOT NULL,
  actual INTEGER NOT NULL CHECK(actual >= 0),
  measurement TEXT NOT NULL
);
