export const benchmarkSchema = `
CREATE TABLE IF NOT EXISTS next_model_benchmarks (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  installation_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('queued','running','cancelling','completed','failed','cancelled')),
  revision INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS next_model_single_benchmark
ON next_model_benchmarks((1)) WHERE state IN ('queued','running','cancelling');
CREATE INDEX IF NOT EXISTS next_model_benchmark_history
ON next_model_benchmarks(actor, installation_id);
`;
