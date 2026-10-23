import type { Database } from "bun:sqlite";
import type { AgentUsageRecorder } from "./domain.ts";

export const repositoryAgentUsageSqliteSchema = `CREATE TABLE IF NOT EXISTS repository_agent_usage (
  workspace_id TEXT NOT NULL REFERENCES next_workspaces(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL, session_id TEXT NOT NULL,
  job_id TEXT NOT NULL, turn INTEGER NOT NULL, state TEXT NOT NULL, payload TEXT NOT NULL,
  PRIMARY KEY(workspace_id,actor_id,session_id,job_id,turn));`;

export function sqliteRepositoryAgentUsage(database: Database): AgentUsageRecorder {
  return {
    async record(owner, usage) {
      database.query(`INSERT INTO repository_agent_usage
        SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM next_workspaces WHERE id=?)
        ON CONFLICT(workspace_id,actor_id,session_id,job_id,turn) DO UPDATE SET state=excluded.state,payload=excluded.payload
        WHERE repository_agent_usage.state != 'known'`).run(owner.workspaceId, owner.actorId, owner.sessionId,
        usage.jobId, usage.turn, usage.state, JSON.stringify(usage), owner.workspaceId);
    },
  };
}
