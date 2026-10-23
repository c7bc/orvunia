import type { PersonalRepository } from "../../workspaces/personal.ts";
import { WorkspaceError } from "../../workspaces/domain.ts";
import type { SqliteConnection } from "./connection.ts";
export function sqlitePersonal(
  connection: SqliteConnection,
  seed: string,
): PersonalRepository {
  const sql = connection.client;
  sql
    .query(
      "INSERT INTO next_personal_workspaces(seed,workspace_id) VALUES(?,?) ON CONFLICT(seed) DO NOTHING",
    )
    .run(seed, seed);
  const current = () => {
    const row = sql
      .query<{ workspace_id: string }, [string]>(
        "SELECT workspace_id FROM next_personal_workspaces WHERE seed=?",
      )
      .get(seed);
    if (!row) throw new WorkspaceError("workspace_conflict");
    return row.workspace_id;
  };
  return {
    current: async () => current(),
    async rotate(expected, next, now) {
      sql
        .transaction(() => {
          if (current() !== expected)
            throw new WorkspaceError("workspace_conflict");
          const busy = sql
            .query(
              "SELECT id FROM next_operations WHERE workspace_id=? AND state IN ('prepared','running') UNION ALL SELECT id FROM next_followup_deliveries WHERE workspace_id=? AND state='processing' LIMIT 1",
            )
            .get(expected, expected);
          if (busy) throw new WorkspaceError("operation_busy");
          sql
            .query(
              "INSERT INTO next_deleted_workspaces(workspace_id,deleted_at) VALUES(?,?)",
            )
            .run(expected, now);
          sql
            .query(
              "UPDATE next_assets SET state='deleting' WHERE workspace_id=? AND state<>'deleted'",
            )
            .run(expected);
          sql
            .query("DELETE FROM next_conversations WHERE workspace_id=?")
            .run(expected);
          sql.query("DELETE FROM next_workspaces WHERE id=?").run(expected);
          sql
            .query("DELETE FROM next_calendars WHERE workspace_id=?")
            .run(expected);
          sql
            .query("DELETE FROM next_followup_attempts WHERE workspace_id=?")
            .run(expected);
          sql
            .query("DELETE FROM next_usage_settlements WHERE workspace_id=?")
            .run(expected);
          sql
            .query("DELETE FROM next_usage WHERE workspace_id=?")
            .run(expected);
          sql
            .query("DELETE FROM next_billing_accounts WHERE workspace_id=?")
            .run(expected);
          sql
            .query("DELETE FROM next_payments WHERE workspace_id=?")
            .run(expected);
          sql
            .query(
              "UPDATE next_personal_workspaces SET workspace_id=? WHERE seed=? AND workspace_id=?",
            )
            .run(next, seed, expected);
        })
        .immediate();
    },
  };
}
