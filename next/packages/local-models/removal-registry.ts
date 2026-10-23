import type { Database } from "bun:sqlite";
import { LocalModelError, type Installation, type ModelRemoval } from "./domain.ts";

type RemovalRow = { request_id: string; installation_id: string; expected_revision: number;
  state: ModelRemoval["state"]; lease: string; lease_until: number };
function decode(row: RemovalRow): ModelRemoval {
  return { requestId: row.request_id, installationId: row.installation_id, expectedRevision: row.expected_revision,
    state: row.state, lease: row.lease, leaseUntil: row.lease_until };
}
export class SqliteModelRemovals {
  constructor(private readonly database: Database) {}
  begin(input: { requestId: string; installationId: string; expectedRevision: number; lease: string; now: number }): ModelRemoval {
    return this.database.transaction(() => {
      const existing = this.database.query<RemovalRow, [string]>("SELECT * FROM next_model_removals WHERE request_id = ?").get(input.requestId);
      if (existing) {
        if (existing.installation_id !== input.installationId || existing.expected_revision !== input.expectedRevision)
          throw new LocalModelError("request_conflict", 409);
        if (existing.state === "completed") return decode(existing);
        if (existing.state === "running" && existing.lease_until > input.now) throw new LocalModelError("installation_busy", 409);
      }
      const owner = this.database.query<RemovalRow, [string]>("SELECT * FROM next_model_removals WHERE installation_id = ?").get(input.installationId);
      if (owner && owner.request_id !== input.requestId) throw new LocalModelError("request_conflict", 409);
      const row = this.database.query<{ data: string }, [string]>("SELECT data FROM next_model_installations WHERE id = ?").get(input.installationId);
      if (!row) throw new LocalModelError("installation_not_found", 404);
      const installation = JSON.parse(row.data) as Installation;
      if (!existing && (installation.state !== "installed" || installation.revision !== input.expectedRevision))
        throw new LocalModelError("installation_conflict", 409);
      if (existing && !["deleting", "failed-cleanup"].includes(installation.state)) throw new LocalModelError("installation_conflict", 409);
      const changed: Installation = { ...installation, state: "deleting", revision: installation.revision + 1,
        removal: { requestId: input.requestId, expectedRevision: input.expectedRevision } };
      this.database.query("UPDATE next_model_installations SET data = ?, revision = ?, state = 'deleting' WHERE id = ?")
        .run(JSON.stringify(changed), changed.revision, installation.id);
      const leaseUntil = input.now + 30_000;
      this.database.query("INSERT INTO next_model_removals VALUES (?, ?, ?, 'running', ?, ?) ON CONFLICT(request_id) DO UPDATE SET state='running', lease=excluded.lease, lease_until=excluded.lease_until")
        .run(input.requestId, input.installationId, input.expectedRevision, input.lease, leaseUntil);
      return { ...input, state: "running" as const, leaseUntil };
    }).immediate();
  }
  finish(requestId: string, lease: string, success: boolean, now: number): void {
    this.database.transaction(() => {
      const removal = this.database.query<RemovalRow, [string]>("SELECT * FROM next_model_removals WHERE request_id = ?").get(requestId);
      if (!removal || removal.lease !== lease || removal.state !== "running" || removal.lease_until <= now)
        throw new LocalModelError("removal_lease_expired", 409);
      const row = this.database.query<{ data: string }, [string]>("SELECT data FROM next_model_installations WHERE id = ?").get(removal.installation_id);
      if (!row) throw new LocalModelError("installation_not_found", 404);
      const installation = JSON.parse(row.data) as Installation;
      if (installation.state !== "deleting") throw new LocalModelError("installation_conflict", 409);
      const changed: Installation = { ...installation, revision: installation.revision + 1, state: success ? "deleted" : "failed-cleanup" };
      if (success) {
        this.database.query("DELETE FROM next_model_files WHERE installation_id = ?").run(installation.id);
        this.database.query("DELETE FROM next_model_artifacts WHERE state = 'deleting' AND NOT EXISTS (SELECT 1 FROM next_model_files f WHERE f.sha256 = next_model_artifacts.sha256)").run();
      }
      this.database.query("UPDATE next_model_installations SET data = ?, revision = ?, state = ? WHERE id = ?")
        .run(JSON.stringify(changed), changed.revision, changed.state, installation.id);
      this.database.query("UPDATE next_model_removals SET state = ?, lease_until = 0 WHERE request_id = ? AND lease = ?")
        .run(success ? "completed" : "failed", requestId, lease);
    }).immediate();
  }
}
