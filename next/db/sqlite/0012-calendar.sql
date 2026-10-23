CREATE TABLE next_calendars (
 workspace_id TEXT PRIMARY KEY,
 revision INTEGER NOT NULL CHECK(revision >= 0),
 state_hash TEXT UNIQUE,
 data TEXT NOT NULL CHECK(json_valid(data))
);
