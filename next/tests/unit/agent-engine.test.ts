import { expect, test } from "bun:test";
import { runAgentLoop } from "../../packages/agent-engine/loop.ts";
import { evaluateAgentPermission, repositoryPermissions } from "../../packages/agent-engine/permissions.ts";

test("adapted Pi loop orders model and tool steps and returns the final response", async () => {
  const events: string[] = [];
  const result = await runAgentLoop({ status: "ready", turns: 0, tools: 0 }, {
    changed: (state) => { events.push(state.status); },
    advance: async (state) => state.turns === 0 ? { status: "waiting_tools", turns: 1, tools: 1 }
      : { ...state, status: "completed", turns: 2 },
    executeTools: async (state) => ({ ...state, status: "ready" }),
  }, new AbortController().signal, 4);
  expect(result.status).toBe("completed");
  expect(events).toEqual(["ready", "waiting_tools", "ready", "completed"]);
});

test("adapted Pi loop stops on cancellation before another model call", async () => {
  const controller = new AbortController(); let calls = 0;
  await expect(runAgentLoop({ status: "ready", turns: 0, tools: 0 }, {
    changed() {}, async advance(state) { calls++; controller.abort(); return { ...state, status: "waiting_tools" }; },
    async executeTools() { throw Error("Should not run"); },
  }, controller.signal, 4)).rejects.toThrow();
  expect(calls).toBe(1);
});

test("adapted Pi loop refuses stalled work instead of consuming more calls", async () => {
  let calls = 0;
  await expect(runAgentLoop({ status: "ready", turns: 0, tools: 0 }, {
    changed() {}, async advance(state) { calls++; return state; }, async executeTools(state) { return state; },
  }, new AbortController().signal, 4)).rejects.toThrow("repository_agent_no_progress");
  expect(calls).toBe(1);
});

test("adapted Pi loop never automatically retries ambiguous or terminal work", async () => {
  for (const status of ["unknown", "failed", "cancelled", "completed"]) {
    const state = { status, turns: 1, tools: 0 };
    expect(await runAgentLoop(state, { changed() {},
      async advance() { throw Error("Unexpected inference"); },
      async executeTools() { throw Error("Unexpected tool"); },
    }, new AbortController().signal, 1)).toBe(state);
  }
});

test("adapted OpenCode rules preserve last-match precedence with a deny-by-default tool policy", () => {
  expect(Object.isFrozen(repositoryPermissions)).toBe(true);
  expect(repositoryPermissions.every(Object.isFrozen)).toBe(true);
  expect(evaluateAgentPermission("repository_read", "snapshot", repositoryPermissions).effect).toBe("allow");
  for (const action of ["bash", "write", "edit", "webfetch", "subagent", "repository_read_extra"])
    expect(evaluateAgentPermission(action, "snapshot", repositoryPermissions).effect).toBe("deny");
  expect(evaluateAgentPermission("new-tool", "repo").effect).toBe("ask");
  expect(evaluateAgentPermission("read", "src/a.ts", [
    { action: "*", resource: "*", effect: "deny" }, { action: "read", resource: "src/*", effect: "allow" },
    { action: "read", resource: "src/secrets.*", effect: "deny" },
  ]).effect).toBe("allow");
  expect(evaluateAgentPermission("read", "src/secrets.ts", [
    { action: "read", resource: "src/*", effect: "allow" },
    { action: "read", resource: "src/secrets.*", effect: "deny" },
  ]).effect).toBe("deny");
});
