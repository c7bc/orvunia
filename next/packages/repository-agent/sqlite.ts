import type { Database } from "bun:sqlite";
import type { AgentJob, AgentOwner, AgentStore } from "./domain.ts";

export const repositoryAgentSqliteSchema = `CREATE TABLE IF NOT EXISTS repository_agent_jobs (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES next_conversations(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL, version INTEGER NOT NULL, payload TEXT NOT NULL,
  UNIQUE(workspace_id,actor_id,session_id,request_id));`;

export function sqliteRepositoryAgent(database: Database): AgentStore {
  const select = database.query<{ payload: string }, [string, string, string, string]>(
    "SELECT payload FROM repository_agent_jobs WHERE workspace_id=? AND actor_id=? AND session_id=? AND id=?");
  return {
    async create(job) {
      return database.transaction(() => {
        database.query("INSERT OR IGNORE INTO repository_agent_jobs VALUES(?,?,?,?,?,?,?)").run(
          job.id, job.owner.workspaceId, job.owner.actorId, job.owner.sessionId, job.requestId, job.version, JSON.stringify(job));
        const row = database.query<{ payload: string }, [string, string, string, string]>(
          "SELECT payload FROM repository_agent_jobs WHERE workspace_id=? AND actor_id=? AND session_id=? AND request_id=?")
          .get(job.owner.workspaceId, job.owner.actorId, job.owner.sessionId, job.requestId);
        if (!row) throw Error("repository_agent_storage_failed");
        return JSON.parse(row.payload) as AgentJob;
      }).immediate();
    },
    async find(owner: AgentOwner, id: string) {
      const row = select.get(owner.workspaceId, owner.actorId, owner.sessionId, id);
      return row ? JSON.parse(row.payload) as AgentJob : null;
    },
    async receipt(owner, requestId) {
      const row = database.query<{ payload: string }, [string, string, string, string]>(
        "SELECT payload FROM repository_agent_jobs WHERE workspace_id=? AND actor_id=? AND session_id=? AND request_id=?")
        .get(owner.workspaceId, owner.actorId, owner.sessionId, requestId);
      return row ? JSON.parse(row.payload) as AgentJob : null;
    },
    async recent(owner, binding, generation) {
      return database.query<{ payload: string }, [string, string, string, string, number, string, number]>(
        `SELECT payload FROM repository_agent_jobs WHERE workspace_id=? AND actor_id=? AND session_id=?
         AND json_extract(payload,'$.status')='completed' AND json_extract(payload,'$.binding.grantId')=?
         AND json_extract(payload,'$.binding.revision')=? AND json_extract(payload,'$.binding.snapshotSha256')=?
         AND json_extract(payload,'$.historyGeneration')=? ORDER BY rowid DESC LIMIT 3`)
        .all(owner.workspaceId, owner.actorId, owner.sessionId, binding.grantId, binding.revision,
          binding.snapshotSha256, generation).map((row) => JSON.parse(row.payload) as AgentJob);
    },
    async save(job, expectedVersion) {
      return database.query("UPDATE repository_agent_jobs SET payload=?,version=? WHERE id=? AND workspace_id=? AND actor_id=? AND session_id=? AND version=?")
        .run(JSON.stringify(job), job.version, job.id, job.owner.workspaceId, job.owner.actorId,
          job.owner.sessionId, expectedVersion).changes === 1;
    },
  };
}
