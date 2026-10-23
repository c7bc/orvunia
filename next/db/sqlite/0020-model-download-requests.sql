CREATE TABLE next_model_download_requests (
  request_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES next_model_jobs(id),
  fingerprint TEXT NOT NULL
);
INSERT INTO next_model_download_requests(request_id, job_id, fingerprint)
SELECT request_id, id, fingerprint FROM next_model_jobs;
CREATE INDEX next_model_job_payload ON next_model_jobs(fingerprint, state);
