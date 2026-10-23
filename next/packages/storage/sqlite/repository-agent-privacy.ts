import { sql } from "drizzle-orm";
import type { SqliteConnection } from "./connection.ts";
import type { SessionChange } from "../../sessions/domain.ts";
import { SessionError } from "../../sessions/domain.ts";

type Database = Pick<SqliteConnection["database"], "run" | "get">;

export function assertRepositoryAgentAppend(database: Database, workspaceId: string,
  sessionId: string, change: SessionChange) {
  const entry = change.append;
  if (entry?.kind !== "responses" || entry.data.action !== "repository-review") return;
  const current = database.get(sql`SELECT id FROM repository_agent_jobs
    WHERE workspace_id=${workspaceId} AND session_id=${sessionId} AND id=${entry.id}
    AND json_extract(payload,'$.status')='completed'
    AND json_extract(payload,'$.historyGeneration')=${change.next.historyGeneration}`);
  if (!current || change.next.state !== "active") throw new SessionError("history_changed");
}

export function invalidateRepositoryAgentJobs(database: Database, workspaceId: string, sessionId: string) {
  database.run(sql`UPDATE repository_agent_jobs SET version=version+1,
    payload=json_set(payload,
      '$.version',version+1,'$.updatedAt',${Date.now()},'$.cancelRequested',json('true'),
      '$.messages',json('[]'),'$.pending',json('[]'),'$.answer',NULL,'$.error','history_changed',
      '$.sourceTranscriptIds',json('[]'),
      '$.status',CASE WHEN json_extract(payload,'$.status') IN ('invoking','unknown') THEN 'unknown' ELSE 'cancelled' END)
    WHERE workspace_id=${workspaceId} AND session_id=${sessionId}`);
}

export function removeRepositoryAgentJobs(
  database: Database,
  workspaceId: string,
  sessionId: string,
) {
  database.run(sql`DELETE FROM repository_agent_jobs
    WHERE workspace_id=${workspaceId} AND session_id=${sessionId}`);
}
