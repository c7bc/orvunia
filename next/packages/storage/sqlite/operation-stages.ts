import type { Operation } from "../../operations/domain.ts";
import { OperationError } from "../../operations/domain.ts";
import type { OperationStage, OperationStageRepository, StageResult } from "../../operations/stages.ts";
import type { SqliteConnection } from "./connection.ts";

type StageRow = { workspace_id: string; operation_kind: Operation["kind"]; operation_id: string; stage_id: string;
  input_hash: string; state: OperationStage["state"]; lease: string; expires_at: number; result: string | null };
const condition = "workspace_id = ? AND operation_kind = ? AND operation_id = ? AND stage_id = ?";
function key(operation: Operation, stageId: string): [string, string, string, string] {
  return [operation.workspaceId, operation.kind, operation.id, stageId];
}
function decode(row: StageRow): OperationStage {
  return { workspaceId: row.workspace_id, operationKind: row.operation_kind, operationId: row.operation_id,
    stageId: row.stage_id, inputHash: row.input_hash, state: row.state, lease: row.lease,
    expiresAt: row.expires_at, result: row.result ? JSON.parse(row.result) as StageResult : null };
}
export class SqliteOperationStages implements OperationStageRepository {
  constructor(private readonly connection: SqliteConnection) {}
  private assertParent(operation: Operation, now: number): void {
    const row = this.connection.client.query<{ lease: string; state: string; cancel_requested: number; expires_at: number; lease_until: number }, [string, string, string]>(
      "SELECT lease, state, cancel_requested, expires_at, lease_until FROM next_operations WHERE workspace_id = ? AND kind = ? AND id = ?",
    ).get(operation.workspaceId, operation.kind, operation.id);
    if (!row || row.lease !== operation.lease || row.state !== "running" || row.cancel_requested || row.expires_at <= now || row.lease_until <= now)
      throw new OperationError("request_conflict");
  }
  async begin(operation: Operation, stageId: string, inputHash: string, now: number): Promise<OperationStage> {
    return this.connection.client.transaction(() => {
      this.assertParent(operation, now);
      const current = this.connection.client.query<StageRow, [string, string, string, string]>(`SELECT * FROM next_operation_stages WHERE ${condition}`).get(...key(operation, stageId));
      if (current) {
        if (current.input_hash !== inputHash) throw new OperationError("request_conflict");
        if (current.state === "completed") return decode(current);
        if (["running", "unknown"].includes(current.state)) throw new OperationError("operation_unknown");
        this.connection.client.query(`UPDATE next_operation_stages SET state = 'running', lease = ? WHERE ${condition}`)
          .run(operation.lease, ...key(operation, stageId));
        return { ...decode(current), state: "running" as const, lease: operation.lease };
      }
      this.connection.client.query("INSERT INTO next_operation_stages VALUES (?, ?, ?, ?, ?, 'running', ?, ?, NULL)")
        .run(...key(operation, stageId), inputHash, operation.lease, operation.expiresAt);
      return { workspaceId: operation.workspaceId, operationKind: operation.kind, operationId: operation.id,
        stageId, inputHash, state: "running" as const, lease: operation.lease, expiresAt: operation.expiresAt, result: null };
    }).immediate();
  }
  async complete(operation: Operation, stageId: string, result: StageResult, now: number): Promise<void> {
    const data = JSON.stringify(result);
    if (Buffer.byteLength(result.text) > 32768 || Buffer.byteLength(data) > 34816) throw new OperationError("snapshot_limit");
    this.connection.client.transaction(() => {
      this.assertParent(operation, now);
      const changed = this.connection.client.query(`UPDATE next_operation_stages SET state = 'completed', result = ? WHERE ${condition} AND lease = ? AND state = 'running'`)
        .run(data, ...key(operation, stageId), operation.lease);
      if (changed.changes !== 1) throw new OperationError("request_conflict");
    }).immediate();
  }
  async fail(operation: Operation, stageId: string, known: boolean): Promise<void> {
    this.connection.client.query(`UPDATE next_operation_stages SET state = ? WHERE ${condition} AND lease = ? AND state = 'running'`)
      .run(known ? "failed" : "unknown", ...key(operation, stageId), operation.lease);
  }
  async purge(now: number): Promise<void> {
    this.connection.client.query("DELETE FROM next_operation_stages WHERE expires_at <= ? OR NOT EXISTS (SELECT 1 FROM next_operations p WHERE p.kind = operation_kind AND p.id = operation_id AND p.workspace_id = next_operation_stages.workspace_id AND p.snapshot IS NOT NULL)").run(now);
  }
}
