import type { Database } from "bun:sqlite";
import { LocalModelError, type DownloadJob, type Installation, type ModelManifest } from "./domain.ts";
import type { ModelRegistry } from "./ports.ts";
import { SqliteModelRemovals } from "./removal-registry.ts";
import { createModelJob } from "./job-registry.ts";

type DataRow = { data: string };
export class SqliteModelRegistry implements ModelRegistry {
  constructor(private readonly database: Database) {}
  beginRemoval: ModelRegistry["beginRemoval"] = (input) => new SqliteModelRemovals(this.database).begin(input);
  finishRemoval: ModelRegistry["finishRemoval"] = (requestId, lease, success, now) => new SqliteModelRemovals(this.database).finish(requestId, lease, success, now);
  createJob(job: DownloadJob, admitCreation?: () => void): DownloadJob {
    return createModelJob(this.database, job, admitCreation);
  }
  findJob(id: string): DownloadJob | null {
    const row = this.database.query<DataRow, [string]>("SELECT data FROM next_model_jobs WHERE id = ?").get(id);
    return row ? JSON.parse(row.data) as DownloadJob : null;
  }
  listJobs(): DownloadJob[] {
    return this.database.query<DataRow, []>("SELECT data FROM next_model_jobs ORDER BY rowid").all()
      .map((row) => JSON.parse(row.data) as DownloadJob);
  }
  replaceJob(job: DownloadJob, expectedRevision: number): boolean {
    return this.database.query("UPDATE next_model_jobs SET data = ?, revision = ?, state = ? WHERE id = ? AND revision = ?")
      .run(JSON.stringify(job), job.progressRevision, job.state, job.id, expectedRevision).changes === 1;
  }
  install(job: DownloadJob, manifest: ModelManifest): Installation {
    return this.database.transaction(() => {
      const current = this.findJob(job.id);
      if (!current || current.state !== "verifying" || current.progressRevision !== job.progressRevision)
        throw new LocalModelError("job_conflict", 409);
      const installation: Installation = {
        id: job.installationId, catalogId: manifest.id, catalogRevision: manifest.revision,
        revision: 1, state: "installed", files: manifest.files.map(({ role, sha256, bytes }) => ({ role, sha256, bytes })),
      };
      this.database.query("INSERT INTO next_model_installations VALUES (?, ?, ?, ?)")
        .run(installation.id, 1, installation.state, JSON.stringify(installation));
      for (const file of manifest.files) {
        const artifact = this.database.query<{ state: string }, [string]>("SELECT state FROM next_model_artifacts WHERE sha256 = ?").get(file.sha256);
        if (artifact?.state === "deleting") throw new LocalModelError("artifact_deleting", 409);
        this.database.query("INSERT INTO next_model_artifacts VALUES (?, ?, 'available') ON CONFLICT DO NOTHING").run(file.sha256, file.bytes);
        this.database.query("INSERT INTO next_model_files VALUES (?, ?, ?)").run(installation.id, file.role, file.sha256);
      }
      const complete: DownloadJob = { ...job, state: "installed", progressRevision: job.progressRevision + 1 };
      if (!this.replaceJob(complete, job.progressRevision)) throw new LocalModelError("job_conflict", 409);
      return installation;
    }).immediate();
  }
  findInstallation(id: string): Installation | null {
    const row = this.database.query<DataRow, [string]>("SELECT data FROM next_model_installations WHERE id = ?").get(id);
    return row ? JSON.parse(row.data) as Installation : null;
  }
  listInstallations(): Installation[] {
    return this.database.query<DataRow, []>("SELECT data FROM next_model_installations ORDER BY rowid").all()
      .map((row) => JSON.parse(row.data) as Installation);
  }
  markDeleting(id: string, expectedRevision: number): Installation {
    return this.database.transaction(() => {
      const current = this.findInstallation(id);
      if (!current) throw new LocalModelError("installation_not_found", 404);
      if (current.revision !== expectedRevision || current.state === "deleted") throw new LocalModelError("installation_conflict", 409);
      const changed: Installation = { ...current, state: "deleting", revision: current.revision + 1 };
      this.database.query("UPDATE next_model_installations SET data = ?, revision = ?, state = ? WHERE id = ?")
        .run(JSON.stringify(changed), changed.revision, changed.state, id);
      return changed;
    }).immediate();
  }
  finishDeletion(id: string, success: boolean): void {
    this.database.transaction(() => {
      const current = this.findInstallation(id);
      if (!current || current.state !== "deleting") throw new LocalModelError("installation_conflict", 409);
      const changed: Installation = { ...current, state: success ? "deleted" : "failed-cleanup", revision: current.revision + 1 };
      if (success) {
        this.database.query("DELETE FROM next_model_files WHERE installation_id = ?").run(id);
        this.database.query("DELETE FROM next_model_artifacts WHERE state = 'deleting' AND NOT EXISTS (SELECT 1 FROM next_model_files WHERE next_model_files.sha256 = next_model_artifacts.sha256)").run();
      }
      this.database.query("UPDATE next_model_installations SET data = ?, revision = ?, state = ? WHERE id = ?")
        .run(JSON.stringify(changed), changed.revision, changed.state, id);
    }).immediate();
  }
  artifactReferences(sha256: string): number {
    return this.database.query<{ count: number }, [string]>(
      "SELECT COUNT(*) AS count FROM next_model_files WHERE sha256 = ?",
    ).get(sha256)?.count ?? 0;
  }
  removableArtifacts(id: string): string[] {
    return this.database.transaction(() => {
      const installation = this.findInstallation(id);
      if (!installation || installation.state !== "deleting") throw new LocalModelError("installation_conflict", 409);
      const removable = installation.files.filter((file) => this.artifactReferences(file.sha256) === 1);
      for (const file of removable) this.database.query("UPDATE next_model_artifacts SET state = 'deleting' WHERE sha256 = ?").run(file.sha256);
      return removable.map((file) => file.sha256);
    }).immediate();
  }
}
