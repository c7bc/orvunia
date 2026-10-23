import type { Database } from "bun:sqlite";
import { LocalModelError, type DownloadJob } from "./domain.ts";

export function createModelJob(database: Database, candidate: DownloadJob, admitCreation: () => void = () => {}): DownloadJob {
  return database.transaction(() => {
    const alias = database.query<{ data: string; fingerprint: string }, [string]>(
      "SELECT j.data, r.fingerprint FROM next_model_download_requests r JOIN next_model_jobs j ON j.id = r.job_id WHERE r.request_id = ?",
    ).get(candidate.requestId);
    if (alias) {
      if (alias.fingerprint !== candidate.fingerprint) throw new LocalModelError("request_conflict", 409);
      return JSON.parse(alias.data) as DownloadJob;
    }
    const reusable = database.query<{ data: string }, [string]>(`
      SELECT j.data FROM next_model_jobs j
      LEFT JOIN next_model_installations i ON i.id = json_extract(j.data, '$.installationId')
      WHERE j.fingerprint = ? AND (j.state IN ('queued', 'downloading', 'verifying')
        OR (j.state = 'installed' AND i.state = 'installed'))
      ORDER BY CASE WHEN j.state = 'installed' THEN 0 ELSE 1 END, j.rowid LIMIT 1
    `).get(candidate.fingerprint);
    const selected = reusable ? JSON.parse(reusable.data) as DownloadJob : candidate;
    if (!reusable || selected.state !== "installed") admitCreation();
    if (!reusable) database.query("INSERT INTO next_model_jobs VALUES (?, ?, ?, ?, ?, ?)")
      .run(candidate.id, candidate.requestId, candidate.fingerprint, candidate.progressRevision, candidate.state, JSON.stringify(candidate));
    database.query("INSERT INTO next_model_download_requests VALUES (?, ?, ?)")
      .run(candidate.requestId, selected.id, candidate.fingerprint);
    return selected;
  }).immediate();
}
