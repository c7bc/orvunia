export const localModelSchema = `
CREATE TABLE IF NOT EXISTS next_model_jobs (
  id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL,
  revision INTEGER NOT NULL, state TEXT NOT NULL, data TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS next_model_single_download
ON next_model_jobs((1)) WHERE state IN ('downloading', 'verifying');
CREATE TABLE IF NOT EXISTS next_model_installations (
  id TEXT PRIMARY KEY, revision INTEGER NOT NULL, state TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS next_model_artifacts (
  sha256 TEXT PRIMARY KEY, bytes INTEGER NOT NULL CHECK(bytes > 0),
  state TEXT NOT NULL CHECK(state IN ('available', 'deleting'))
);
CREATE TABLE IF NOT EXISTS next_model_files (
  installation_id TEXT NOT NULL REFERENCES next_model_installations(id),
  role TEXT NOT NULL, sha256 TEXT NOT NULL REFERENCES next_model_artifacts(sha256),
  PRIMARY KEY(installation_id, role)
);
`;
