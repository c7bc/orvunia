import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { sessions } from "../../packages/sessions/service.ts";
import { spokenContextInstructions, foundationInstructions, calibrationExample } from "../../packages/answers/policy.ts";
import { providerStream } from "../support/provider-stream.ts";
import { foundationSystemPrompt } from "../../packages/prompts/foundation-en.ts";

test("persisted builtin and authorial mode prompts stay authoritative without hidden base guidance or data rewriting", async () => {
  const environment = await capabilityEnvironment();
  try {
    const customId = crypto.randomUUID();
    await environment.workspace.update(environment.owner, workspace => {
      const builtin = workspace.modes.find(mode => mode.id === "technical")!;
      builtin.instructions = "AUTHORIAL_BUILTIN_STYLE";
      builtin.systemPrompt = "AUTHORIAL_BUILTIN_SYSTEM";
      workspace.modes.push({ ...structuredClone(builtin), id: customId, name: "Authored mode",
        builtin: false, systemPrompt: "AUTHORIAL_CUSTOM_SYSTEM", instructions: "AUTHORIAL_CUSTOM_STYLE" });
    });
    const sessionService = sessions({ repository: environment.sessions,
      mode: async (owner, id) => (await environment.workspace.find(owner)).modes.find(mode => mode.id === id) ?? null,
      identifier: () => crypto.randomUUID(), clock: () => new Date(environment.now()) });
    for (const [id, style] of [["technical", "AUTHORIAL_BUILTIN_STYLE"], [customId, "AUTHORIAL_CUSTOM_STYLE"]] as const) {
      const session = await sessionService.create(environment.owner, { title: "Controlled old mode", mode: "technical", modeId: id });
      const preserved = structuredClone(session.modeSnapshot);
      const workspaceBefore = await environment.workspace.find(environment.owner);
      environment.input.requestId = crypto.randomUUID();
      const operation = await environment.service.prepare(environment.owner, session.id, environment.input, false);
      expect(operation.snapshot!.instructions).not.toContain(spokenContextInstructions);
      expect(operation.snapshot!.instructions).not.toContain(foundationInstructions);
      expect(operation.snapshot!.instructions).not.toContain(calibrationExample);
      expect(operation.snapshot!.instructions).not.toContain(foundationSystemPrompt);
      expect(operation.snapshot!.instructions).toContain(style);
      expect(operation.snapshot!.instructions).toContain(style.replace("_STYLE", "_SYSTEM"));
      await environment.run(operation);
      expect(environment.requests.at(-1)!.body.instructions).toBe(operation.snapshot!.instructions);
      expect((await environment.sessions.find(environment.owner, session.id))!.modeSnapshot).toEqual(preserved);
      expect(await environment.workspace.find(environment.owner)).toEqual(workspaceBefore);
    }
    expect(environment.requests).toHaveLength(2);
  } finally { await environment.close(); }
});

test("confirmed retry keeps its original authored prompt snapshot, while a fresh question uses the live edited mode", async () => {
  const environment = await capabilityEnvironment();
  try {
    const previousMode = "CONTROLLED_PREVIOUS_AUTHORIAL_MODE", nextMode = "CONTROLLED_UPDATED_AUTHORIAL_MODE";
    await environment.workspace.update(environment.owner, workspace => {
      workspace.modes.find(mode => mode.id === "technical")!.instructions = previousMode;
      workspace.modes.find(mode => mode.id === "technical")!.systemPrompt = "PREVIOUS_SYSTEM";
    });
    const original = await environment.prepare(), previousPolicy = original.snapshot!.instructions;
    expect(previousPolicy).toContain(previousMode);
    environment.upstream(async () => Response.json({ error: { message: "Controlled rejection" } }, { status: 401 }));
    await expect(environment.run(original)).rejects.toMatchObject({ code: "provider_auth" });
    await environment.workspace.update(environment.owner, workspace => {
      workspace.modes.find(mode => mode.id === "technical")!.instructions = nextMode;
      workspace.modes.find(mode => mode.id === "technical")!.systemPrompt = "UPDATED_SYSTEM";
    });
    const retry = await environment.prepare();
    expect(retry.snapshot).toEqual(original.snapshot);
    expect(retry.snapshot!.instructions).toBe(previousPolicy);
    expect(retry.snapshot!.instructions).toContain("PREVIOUS_SYSTEM");
    expect(retry.snapshot!.instructions).not.toContain("UPDATED_SYSTEM");
    environment.upstream(async () => providerStream([{ type: "response.output_text.delta", delta: "Controlled fixture output" },
      { type: "response.completed", response: {} }]));
    await environment.run(retry);
    expect(environment.requests[1]!.body.instructions).toBe(previousPolicy);
    expect(environment.requests[1]!.body).toEqual(environment.requests[0]!.body);
    expect(environment.requests).toHaveLength(2);
    environment.input.requestId = crypto.randomUUID();
    const fresh = await environment.prepare();
    expect(fresh.snapshot!.instructions).not.toContain(spokenContextInstructions);
    expect(fresh.snapshot!.instructions).not.toContain(foundationInstructions);
    expect(fresh.snapshot!.instructions).not.toContain(foundationSystemPrompt);
    expect(fresh.snapshot!.instructions).toContain("UPDATED_SYSTEM");
    expect(fresh.snapshot!.instructions).not.toContain("PREVIOUS_SYSTEM");
    expect(fresh.snapshot!.instructions).toContain(nextMode);
    expect(fresh.snapshot!.instructions).not.toContain(previousMode);
    expect((await environment.operations.find(environment.owner, "answer", original.id))!.snapshot).toEqual(original.snapshot);
  } finally { await environment.close(); }
});
