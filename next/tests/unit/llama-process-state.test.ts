import { test, expect } from "bun:test";
import { LlamaRuntime } from "../../packages/local-models/llama.ts";

for (const state of [
  { exitCode: null, signalCode: "SIGKILL" }, { exitCode: null, signalCode: "SIGTERM" }, { exitCode: 0, signalCode: null },
]) test(`a process that has exited cannot receive another generation: ${JSON.stringify(state)}`, async () => {
  let requests = 0;
  const request = Object.assign(async () => {
    requests++; return Response.json({ choices: [{ message: { content: "Unexpected request" } }] });
  }, { preconnect: fetch.preconnect });
  const runtime = new LlamaRuntime({ path: "not-launched", sha256: "invalid", version: "synthetic" }, request);
  Reflect.set(runtime, "loaded", { handle: { id: "synthetic-handle", capabilities: ["text"] }, child: state,
    url: "http://127.0.0.1:1", token: "synthetic-not-sent", outputTokens: 64, users: 0, disableThinking: false });
  await expect(runtime.generate("synthetic-handle", "synthetic-operation", { instructions: "Synthetic", prompt: "Synthetic", images: [] },
    new AbortController().signal)).rejects.toMatchObject({ code: "runtime_not_loaded" });
  expect(requests).toBe(0);
});

test("a live process still receives exactly one generation request", async () => {
  let requests = 0;
  const request = Object.assign(async () => {
    requests++; return Response.json({ choices: [{ message: { content: "Useful synthetic response" } }] });
  }, { preconnect: fetch.preconnect });
  const runtime = new LlamaRuntime({ path: "not-launched", sha256: "invalid", version: "synthetic" }, request);
  Reflect.set(runtime, "loaded", { handle: { id: "synthetic-handle", capabilities: ["text"] },
    child: { exitCode: null, signalCode: null }, url: "http://127.0.0.1:1", token: "synthetic-not-sent", outputTokens: 64, users: 0, disableThinking: false });
  expect(await runtime.generate("synthetic-handle", "synthetic-operation", { instructions: "Synthetic", prompt: "Synthetic", images: [] },
    new AbortController().signal)).toBe("Useful synthetic response");
  expect(requests).toBe(1);
});
