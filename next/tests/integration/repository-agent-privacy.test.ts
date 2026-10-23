import { repositoryAgentPrivacyCases } from "../support/repository-agent-privacy-cases.ts";
import { repositoryAgentFixture } from "../support/repository-agent-fixture.ts";
import { sqliteRepositoryAgentUsage } from "../../packages/repository-agent/sqlite-usage.ts";
import type { AgentUsage } from "../../packages/repository-agent/domain.ts";

repositoryAgentPrivacyCases("SQLite", async () => {
  const context = await repositoryAgentFixture();
  const database = context.connection.client;
  return { ...context, usage: sqliteRepositoryAgentUsage(database),
    async usageRows(owner) {
      return database.query<{ payload: string }, [string]>("SELECT payload FROM repository_agent_usage WHERE workspace_id=? ORDER BY job_id,turn")
        .all(owner.workspaceId).map((row) => JSON.parse(row.payload) as AgentUsage);
    },
    async seedFinancial(owner, id) {
      database.query(`INSERT INTO next_usage(id,workspace_id,request_key,kind,period,units,actual,state,created_at,lease_until,measurement)
        VALUES(?,?,?,'answers','synthetic',1,0,'unknown',1,2,'{}')`).run(id, owner.workspaceId, id);
    },
    async financial(owner, id) {
      return database.query<{ state: string }, [string, string]>("SELECT state FROM next_usage WHERE workspace_id=? AND id=?")
        .get(owner.workspaceId, id)?.state ?? null;
    },
    async purge(owner) {
      database.transaction(() => {
        database.query("DELETE FROM repository_agent_jobs WHERE workspace_id=?").run(owner.workspaceId);
        database.query("DELETE FROM next_conversations WHERE workspace_id=?").run(owner.workspaceId);
        database.query("DELETE FROM next_workspaces WHERE id=?").run(owner.workspaceId);
      }).immediate();
    },
  };
});
