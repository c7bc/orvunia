import { expect, test } from "bun:test";
import { capabilityEnvironment } from "../support/capability-environment.ts";
import { expansionContext } from "../../packages/expansions/context.ts";
import { SqliteExpansions } from "../../packages/storage/sqlite/expansions.ts";
import { modes } from "../../packages/workspaces/modes.ts";
import { foundationSystemPrompt } from "../../packages/prompts/foundation-en.ts";

const suffix = "\nExplain the saved answer in more detail. Preserve the original factual constraints; state missing context instead of inventing it.";

test("saved-answer-only expansion uses both live selected mode fields and respects independently empty fields", async () => {
  const environment = await capabilityEnvironment();
  try {
    const service = modes(environment.workspace, () => crypto.randomUUID(), () => new Date(environment.now()));
    const created = await service.create(environment.owner, { base: "technical", name: "Expansion role" });
    const session = await environment.sessions.create({ ...environment.session, id: crypto.randomUUID(), modeSnapshot: created.mode });
    const sourceId = crypto.randomUUID();
    await environment.sessions.change(environment.owner, session.id, current => ({ next: current,
      append: { id: sourceId, conversationId: current.id, kind: "responses", segmentId: null,
        data: { id: sourceId, text: "SAVED_ANSWER", mode: "technical", model: "legacy", action: "assist",
          date: new Date(environment.now()).toISOString() } } }));
    const dependencies = { ...environment.dependencies, stages: new SqliteExpansions(environment.connection) };
    for (const [systemPrompt, instructions] of [["LIVE_SYSTEM", "LIVE_DETAILS"], ["", "LIVE_DETAILS"], ["LIVE_SYSTEM", ""], ["", ""]] as const) {
      await service.edit(environment.owner, created.mode.id, { systemPrompt, instructions });
      const expansion = await expansionContext(dependencies, environment.owner, session.id, sourceId, crypto.randomUUID());
      expect(expansion.contextSource).toBe("saved-answer-only");
      expect(expansion.snapshot.instructions).toContain(`# System prompt\n${systemPrompt}`);
      expect(expansion.snapshot.instructions).toContain(`# Mode instructions\n${instructions}`);
      expect(expansion.snapshot.instructions.includes("LIVE_SYSTEM")).toBe(Boolean(systemPrompt));
      expect(expansion.snapshot.instructions.includes("LIVE_DETAILS")).toBe(Boolean(instructions));
      expect(expansion.snapshot.instructions).not.toContain(foundationSystemPrompt);
      expect(JSON.parse(expansion.snapshot.context)).toMatchObject({ saved_answer: "SAVED_ANSWER", original_context: null });
    }
    expect(environment.requests).toHaveLength(0);
    expect((await environment.sessions.find(environment.owner, session.id))!.modeSnapshot).toEqual(created.mode);
  } finally { await environment.close(); }
});

test("an expansion with a retained original snapshot keeps its exact instructions and context after both mode fields change", async () => {
  const environment = await capabilityEnvironment();
  try {
    const service = modes(environment.workspace, () => crypto.randomUUID(), () => new Date(environment.now()));
    await service.edit(environment.owner, "technical", { systemPrompt: "ORIGINAL_SYSTEM", instructions: "ORIGINAL_DETAILS" });
    const original = await environment.prepare();
    const answer = await environment.run(original);
    await service.edit(environment.owner, "technical", { systemPrompt: "NEW_SYSTEM", instructions: "NEW_DETAILS" });
    const dependencies = { ...environment.dependencies, stages: new SqliteExpansions(environment.connection) };
    const expansion = await expansionContext(dependencies, environment.owner, environment.session.id, answer.id, crypto.randomUUID());
    expect(expansion.contextSource).toBe("original-snapshot");
    expect(expansion.snapshot.instructions).toBe(original.snapshot!.instructions + suffix);
    expect(expansion.snapshot.instructions).not.toContain("NEW_SYSTEM");
    expect(expansion.snapshot.instructions).not.toContain("NEW_DETAILS");
    expect(JSON.parse(expansion.snapshot.context).original_context).toBe(original.snapshot!.context);
    expect(expansion.snapshot.retainedFrom).toEqual({ kind: "answer", id: original.id });
    expect((await environment.operations.find(environment.owner, "answer", original.id))!.snapshot).toEqual(original.snapshot);
    expect(environment.requests).toHaveLength(1);
  } finally { await environment.close(); }
});
