import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { modes } from "../../packages/workspaces/modes.ts";
import { foundationInstructions, calibrationExample } from "../../packages/answers/policy.ts";
import { providerStream } from "../support/provider-stream.ts";
import { foundationSystemPrompt } from "../../packages/prompts/foundation-en.ts";
import { globalSystemPrompt } from "../../packages/prompts/global.ts";
import { customModePatchSchema } from "../../packages/contracts/modes.ts";
import { definedFields } from "../../packages/contracts/defined.ts";
const interviewer = "Speak as the interviewer using the second person. Ask a focused follow-up question.";
const teacher = "Speak as a teacher in the third person. Explain the concept without a candidate narrative.";
test("editing and clearing the visible builtin prompt affects new questions in the existing session", async () => {
  const environment = await capabilityEnvironment();
  try {
    const service = modes(environment.workspace, () => crypto.randomUUID(), () => new Date(environment.now()));
    await service.edit(environment.owner, "technical", { systemPrompt: interviewer, instructions: "MODE_DETAILS" });
    await service.edit(environment.owner, "technical", definedFields(customModePatchSchema.parse({ name: "Renamed" })));
    const first = await environment.prepare(); await environment.run(first);
    expect(first.snapshot?.instructions).toContain(interviewer);
    expect(first.snapshot?.instructions).toContain("# Mode instructions\nMODE_DETAILS");
    expect(first.snapshot?.instructions).not.toContain(foundationSystemPrompt);
    expect(first.snapshot?.instructions).not.toContain(foundationInstructions);
    expect(environment.requests.at(-1)!.body.instructions).toBe(first.snapshot?.instructions);
    await service.edit(environment.owner, "technical", { systemPrompt: "" });
    const independent = (await service.list(environment.owner)).modes.find(mode => mode.id === "technical")!;
    expect(independent.systemPrompt).toBe(""); expect(independent.instructions).toBe("MODE_DETAILS");
    await service.edit(environment.owner, "technical", { instructions: "" });
    expect((await service.list(environment.owner)).modes.find(mode => mode.id === "technical")!.systemPrompt).toBe("");
    environment.input.requestId = crypto.randomUUID();
    const cleared = await environment.prepare(); await environment.run(cleared);
    expect(cleared.snapshot?.instructions).not.toContain(interviewer);
    expect(cleared.snapshot?.instructions).not.toContain(foundationInstructions);
    expect(cleared.snapshot?.instructions).not.toContain(calibrationExample);
    expect(cleared.snapshot?.instructions).not.toContain(foundationSystemPrompt);
    expect(cleared.snapshot?.instructions).not.toContain(globalSystemPrompt("en"));
    expect(cleared.snapshot?.instructions).not.toContain("MODE_DETAILS");
    expect(cleared.snapshot?.instructions).not.toContain("# Response voice");
    expect(environment.requests).toHaveLength(2);
    expect((await environment.sessions.find(environment.owner, environment.session.id))!.modeSnapshot).toBeNull();
  } finally { await environment.close(); }
});
test("a confirmed retry keeps its original authored prompt and payload while a new request sees the latest edit", async () => {
  const environment = await capabilityEnvironment();
  try {
    const service = modes(environment.workspace, () => crypto.randomUUID(), () => new Date(environment.now()));
    await service.edit(environment.owner, "technical", { systemPrompt: interviewer, instructions: "ORIGINAL_DETAILS" });
    environment.upstream(async () => Response.json({ error: { message: "controlled rejection" } }, { status: 401 }));
    const original = await environment.prepare();
    await expect(environment.run(original)).rejects.toMatchObject({ code: "provider_auth" });
    const originalPayload = structuredClone(environment.requests[0]!.body);
    await service.edit(environment.owner, "technical", { systemPrompt: teacher, instructions: "UPDATED_DETAILS" });
    const retry = await environment.prepare(); expect(retry.snapshot).toEqual(original.snapshot);
    environment.upstream(async () => providerStream([
      { type: "response.output_text.delta", delta: "Controlled retry" }, { type: "response.completed", response: {} },
    ]));
    await environment.run(retry);
    expect(environment.requests[1]!.body).toEqual(originalPayload);
    expect(environment.requests[1]!.body.instructions).toContain(interviewer);
    expect(environment.requests[1]!.body.instructions).toContain("ORIGINAL_DETAILS");
    expect(environment.requests[1]!.body.instructions).not.toContain("UPDATED_DETAILS");
    expect(environment.requests[1]!.body.instructions).not.toContain(teacher);
    expect(await environment.run(await environment.prepare())).toMatchObject({ text: "Controlled retry" });
    expect(environment.requests).toHaveLength(2);
    environment.input.requestId = crypto.randomUUID();
    const fresh = await environment.prepare(); expect(fresh.snapshot?.instructions).toContain(teacher);
    expect(fresh.snapshot?.instructions).not.toContain(interviewer);
    expect(fresh.snapshot?.instructions).toContain("UPDATED_DETAILS");
    expect(fresh.snapshot?.instructions).not.toContain("ORIGINAL_DETAILS");
    await environment.run(fresh); expect(environment.requests).toHaveLength(3);
    expect((await environment.sessions.counts(environment.owner, environment.session.id)).responses).toBe(2);
  } finally { await environment.close(); }
});
test("a selected custom mode uses live prompt edits while retaining its session's documents and notes", async () => {
  const environment = await capabilityEnvironment();
  try {
    const service = modes(environment.workspace, () => crypto.randomUUID(), () => new Date(environment.now()));
    const created = await service.create(environment.owner, { base: "technical", name: "Custom voice" });
    const date = new Date(environment.now()).toISOString();
    const document = { id: crypto.randomUUID(), name: "Snapshot reference", date, text: "SNAPSHOT_DOCUMENT" };
    const saved = await service.edit(environment.owner, created.mode.id, { systemPrompt: interviewer, instructions: "SNAPSHOT_DETAILS",
      documents: [document], sections: [{ title: "Saved notes", instructions: "SNAPSHOT_NOTES" }] });
    const session = await environment.sessions.create({ ...environment.session, id: crypto.randomUUID(), modeSnapshot: saved.mode });
    await service.edit(environment.owner, created.mode.id, { systemPrompt: teacher, instructions: "LIVE_DETAILS",
      documents: [{ ...document, text: "LIVE_DOCUMENT" }], sections: [{ title: "New notes", instructions: "LIVE_NOTES" }] });
    const operation = await environment.service.prepare(environment.owner, session.id,
      { ...environment.input, action: "recap" }, false);
    expect(operation.snapshot?.instructions).toContain(teacher); expect(operation.snapshot?.instructions).not.toContain(interviewer);
    expect(operation.snapshot?.instructions).toContain("LIVE_DETAILS"); expect(operation.snapshot?.instructions).not.toContain("SNAPSHOT_DETAILS");
    expect(operation.snapshot?.instructions).toContain("SNAPSHOT_NOTES"); expect(operation.snapshot?.instructions).not.toContain("LIVE_NOTES");
    expect(operation.snapshot?.context).toContain("SNAPSHOT_DOCUMENT"); expect(operation.snapshot?.context).not.toContain("LIVE_DOCUMENT");
    const stored = (await environment.sessions.find(environment.owner, session.id))!.modeSnapshot!;
    expect(stored.systemPrompt).toBe(interviewer); expect(stored.instructions).toBe("SNAPSHOT_DETAILS");
  } finally { await environment.close(); }
});
