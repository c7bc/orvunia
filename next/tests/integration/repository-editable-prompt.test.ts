import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { repositoryPrompt } from "../../apps/api/repository-prompt.ts";
import { repositoryComposition } from "../../apps/api/repository-composition.ts";
import { modes } from "../../packages/workspaces/modes.ts";
import { sqliteRepositoryAgent, repositoryAgentSqliteSchema } from "../../packages/repository-agent/sqlite.ts";
import { sqliteRepositoryAgentUsage, repositoryAgentUsageSqliteSchema } from "../../packages/repository-agent/sqlite-usage.ts";
import { repositoryAgentInstructions } from "../../packages/repository-agent/definitions.ts";
import { repositoryProviderStream } from "../support/repository-provider.ts";
test("repository helper and production composition forward a live edited or empty mode and its output language", async () => {
  const environment = await capabilityEnvironment(), requests: Record<string, unknown>[] = [];
  environment.connection.client.exec(repositoryAgentSqliteSchema + repositoryAgentUsageSqliteSchema);
  const presentation = repositoryPrompt(environment.workspace, environment.sessions);
  const owner = { workspaceId: environment.owner, actorId: crypto.randomUUID(), sessionId: environment.session.id };
  const modeService = modes(environment.workspace, () => crypto.randomUUID(), () => new Date(environment.now()));
  const composition = repositoryComposition({ sessions: environment.sessions,
    store: sqliteRepositoryAgent(environment.connection.client), usage: sqliteRepositoryAgentUsage(environment.connection.client),
    accounting: environment.dependencies.usage, providers: environment.dependencies.providers, presentation,
    transport: async (_url, options) => {
      requests.push(JSON.parse(String(options?.body)) as Record<string, unknown>);
      return repositoryProviderStream({ id: crypto.randomUUID(), object: "response", status: "completed", model: "controlled-repository",
        output: [{ type: "message", id: crypto.randomUUID(), role: "assistant", status: "completed",
          content: [{ type: "output_text", text: "Controlled authored response", annotations: [] }] }],
        usage: { input_tokens: 10, output_tokens: 3, total_tokens: 13,
          input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } });
    } });
  try {
    await environment.workspace.update(environment.owner, workspace => { workspace.preferences.output = "es"; });
    for (const authored of ["Act as an interviewer using the second person.", ""]) {
      const details = authored ? "Prefer SQL examples." : "";
      await modeService.edit(environment.owner, "technical", { systemPrompt: authored, instructions: details });
      const expected = `# System prompt\n${authored}\n\n# Mode instructions\n${details}\n\n# Output language\nes`;
      expect(await presentation(owner)).toBe(expected);
      const job = await composition.service.start(owner, { requestId: crypto.randomUUID(), consent: true,
        question: "Explain the supplied code", binding: { grantId: crypto.randomUUID(), revision: 1, snapshotSha256: "a".repeat(64) } });
      const completed = await composition.service.advance(owner, job.id, new AbortController().signal);
      expect(completed.status).toBe("completed");
      expect(requests.at(-1)!.instructions).toBe(`${repositoryAgentInstructions}\n${expected}`);
      expect(String(requests.at(-1)!.instructions)).not.toContain("candidate");
      expect(String(requests.at(-1)!.instructions)).not.toContain("Voz nas entrevistas");
    }
    expect(requests).toHaveLength(2);
  } finally { await composition.service.close(); await environment.close(); }
});
test("repository helper uses a deleted mode's saved prompt and refuses a different workspace's session", async () => {
  const environment = await capabilityEnvironment();
  try {
    const date = new Date(environment.now()).toISOString(), authored = "Use a third-person narrator.";
    const session = await environment.sessions.create({ ...environment.session, id: crypto.randomUUID(),
      modeSnapshot: { id: crypto.randomUUID(), name: "Deleted role", base: "technical", systemPrompt: authored, instructions: "SAVED_DETAILS",
        sections: [], documents: [], builtin: false, created: date, updated: date } });
    const presentation = repositoryPrompt(environment.workspace, environment.sessions);
    const owner = { workspaceId: environment.owner, actorId: crypto.randomUUID(), sessionId: session.id };
    expect(await presentation(owner)).toBe(`# System prompt\n${authored}\n\n# Mode instructions\nSAVED_DETAILS\n\n# Output language\npt-BR`);
    await expect(presentation({ ...owner, workspaceId: crypto.randomUUID() })).rejects.toMatchObject({ code: "repository_agent_not_found" });
  } finally { await environment.close(); }
});
