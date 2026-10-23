import { expect, test } from "bun:test";
import { LlamaRuntime, llamaProcessArguments } from "../../packages/local-models/llama.ts";
import { syntheticManifest } from "../support/local-models.ts";
import { deferred, until } from "../support/benchmarks.ts";

const input = { instructions: "Test", prompt: "Test", images: [] };
function fixture(drain: Promise<void> = Promise.resolve()) {
  const requests: Record<string, unknown>[] = []; let stops = 0;
  const loaded = { handle: { id: "own", capabilities: ["text"] }, child: { pid: 123, exitCode: null, signalCode: null },
    url: "http://127.0.0.1:1", token: "synthetic", outputTokens: 128, users: 0, disableThinking: true, cpuOnly: true };
  const request = Object.assign(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>; requests.push(body);
    return body.stream ? new Response('data: {"choices":[{"delta":{"content":"[1]"}}],"timings":{"predicted_n":3,"predicted_ms":150}}\n\ndata: [DONE]\n\n',
      { headers: { "content-type": "text/event-stream" } }) : Response.json({ choices: [{ message: { content: "normal" } }] });
  }, { preconnect: fetch.preconnect });
  const runtime = new LlamaRuntime({ path: "not-launched", sha256: "0".repeat(64), version: "controlled" }, request,
    () => ({ async stop() { stops++; await drain; return { bytes: 1024, samples: 2, source: "windows-workingset", unavailableReasons: [] }; } }));
  Reflect.set(runtime, "loaded", loaded);
  return { runtime, loaded, requests, stops: () => stops };
}
test("benchmark measures SSE and own-process memory while ordinary generation retains nonstreaming protocol", async () => {
  const f = fixture();
  const measured = await f.runtime.measureGeneration("own", "measured", input, new AbortController().signal);
  expect(measured).toMatchObject({ output: "[1]", telemetry: { generatedTokens: 3, generationMilliseconds: 150,
    tokensPerSecond: 20, residentMemoryBytes: 1024, memorySamples: 2, vramBytes: 0,
    provenance: { vram: "policy-cpu-disabled", residentMemory: "windows-workingset" } } });
  expect(measured.latencyMilliseconds).toBeNumber(); expect(measured.telemetry.timeToFirstTokenMilliseconds).toBeNumber();
  expect(f.requests[0]).toMatchObject({ stream: true, stream_options: { include_usage: true }, timings_per_token: true,
    chat_template_kwargs: { enable_thinking: false } });
  expect(await f.runtime.generate("own", "normal", input, new AbortController().signal)).toBe("normal");
  expect(f.requests[1]?.stream).toBe(false); expect(f.requests[1]).not.toHaveProperty("stream_options");
  expect(f.loaded.users).toBe(0); expect(f.stops()).toBe(1);
});

test("measured completion retains admission through memory drain and reports result latency before drain", async () => {
  const gate = deferred(); const f = fixture(gate.promise);
  let settled = false;
  const pending = f.runtime.measureGeneration("own", "measured", input, new AbortController().signal).then(value => { settled = true; return value; });
  await until(() => f.stops() === 1);
  expect(settled).toBe(false); expect(f.loaded.users).toBe(1);
  await expect(f.runtime.generate("own", "second", input, new AbortController().signal)).rejects.toThrow("runtime_busy");
  await expect(f.runtime.unload("own")).rejects.toThrow("runtime_in_use");
  gate.resolve(); const result = await pending;
  expect(result.latencyMilliseconds).toBeNumber(); expect(f.loaded.users).toBe(0); expect(f.requests).toHaveLength(1);
});

test("pinned CPU server flags disable device, operation, KV and projector offload explicitly", () => {
  const args = llamaProcessArguments({ installationId: "test", manifest: syntheticManifest(), files: [{ role: "projector", path: "projector" }],
    contextTokens: 128, maximumOutputTokens: 64, threads: 2 }, "weights", 1234, "key", "alias");
  for (const flag of ["--no-op-offload", "--no-kv-offload", "--no-mmproj-offload"]) expect(args).toContain(flag);
  expect(args[args.indexOf("--device") + 1]).toBe("none");
  expect(args[args.indexOf("--n-gpu-layers") + 1]).toBe("0");
});
