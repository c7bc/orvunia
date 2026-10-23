export const modelRemovalSchema = `
CREATE TABLE IF NOT EXISTS next_model_removals (
  request_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL UNIQUE REFERENCES next_model_installations(id),
  expected_revision INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('running', 'completed', 'failed')),
  lease TEXT NOT NULL,
  lease_until INTEGER NOT NULL
);
`;
