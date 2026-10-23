import type { Database } from "bun:sqlite";
import { LocalModelError } from "../domain.ts";
import type { BenchmarkJob } from "./types.ts";
import type { BenchmarkStore } from "./ports.ts";

type Row = { data: string };
export class SqliteBenchmarks implements BenchmarkStore {
  constructor(private readonly database: Database) {}
  find(actor: string, id: string): BenchmarkJob | null {
    const row = this.database.query<Row, [string, string]>(
      "SELECT data FROM next_model_benchmarks WHERE actor=? AND id=?").get(actor, id);
    return row ? JSON.parse(row.data) as BenchmarkJob : null;
  }
  findRequest(actor: string, requestId: string): BenchmarkJob | null {
    const row = this.database.query<Row, [string, string]>(
      "SELECT data FROM next_model_benchmarks WHERE actor=? AND request_id=?").get(actor, requestId);
    return row ? JSON.parse(row.data) as BenchmarkJob : null;
  }
  list(actor: string, installationId: string): BenchmarkJob[] {
    return this.database.query<Row, [string, string]>(
      "SELECT data FROM next_model_benchmarks WHERE actor=? AND installation_id=? ORDER BY rowid DESC LIMIT 20")
      .all(actor, installationId).map(row => JSON.parse(row.data) as BenchmarkJob);
  }
  create(actor: string, job: BenchmarkJob): void {
    this.database.transaction(() => {
      const duplicate = this.database.query("SELECT id FROM next_model_benchmarks WHERE request_id=?").get(job.requestId);
      if (duplicate) throw new LocalModelError("request_conflict", 409);
      const busy = this.database.query("SELECT id FROM next_model_benchmarks WHERE state IN ('queued','running','cancelling')").get();
      if (busy) throw new LocalModelError("benchmark_busy", 409);
      this.database.query("INSERT INTO next_model_benchmarks VALUES (?,?,?,?,?,?,?)")
        .run(job.id, actor, job.requestId, job.installationId, job.state, job.revision, JSON.stringify(job));
    }).immediate();
  }
  replace(job: BenchmarkJob): void {
    const result = this.database.query("UPDATE next_model_benchmarks SET state=?, revision=?, data=? WHERE id=? AND revision=?")
      .run(job.state, job.revision, JSON.stringify(job), job.id, job.revision - 1);
    if (result.changes !== 1) throw new LocalModelError("benchmark_conflict", 409);
  }
  interrupt(now: number): void {
    this.database.transaction(() => {
      const rows = this.database.query<Row, []>(
        "SELECT data FROM next_model_benchmarks WHERE state IN ('queued','running','cancelling')").all();
      for (const row of rows) {
        const job = JSON.parse(row.data) as BenchmarkJob;
        this.replace({ ...job, revision: job.revision + 1, state: "failed", finishedAt: now,
          error: { code: "benchmark_interrupted" } });
      }
    }).immediate();
  }
}
