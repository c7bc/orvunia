import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import * as filesystem from "node:fs/promises";
import * as processPorts from "../../packages/local-models/process.ts";
import { WhisperRuntime } from "../../packages/local-models/whisper.ts";
import { silenceWave } from "../support/speech-metrics.ts";

afterEach(() => mock.restore());
test("only benchmark Whisper adds explicit CPU flag and captures own-child RSS, with STT token metrics not applicable", async () => {
  const argumentsList: string[][] = []; let memoryCalls = 0; let stopped = 0;
  const runtime = new WhisperRuntime({ path: "not-launched", sha256: "0".repeat(64), version: "controlled" },
    () => { memoryCalls++; return { async stop() { return { bytes: 4096, samples: 4, source: "linux-proc-vmrss", unavailableReasons: [] }; } }; });
  Reflect.set(runtime, "loaded", { handle: { id: "loaded" }, weights: "synthetic", threads: 2, users: 0 });
  spyOn(processPorts, "verifyRuntime").mockResolvedValue(undefined);
  spyOn(processPorts, "spawnRuntime").mockImplementation((_binary, args) => { argumentsList.push(args); return new EventEmitter() as ChildProcess; });
  spyOn(processPorts, "processCompletion").mockResolvedValue(0);
  spyOn(processPorts, "stopOwnedProcess").mockImplementation(async () => { stopped++; });
  spyOn(filesystem, "readFile").mockResolvedValue(Buffer.from("Useful speech"));
  const audio = silenceWave(1); audio[44] = 1;
  const result = await runtime.measureTranscription("loaded", "measured", audio, "es", new AbortController().signal);
  expect(result).toMatchObject({ output: "Useful speech", telemetry: {
    timeToFirstTokenMilliseconds: null, generatedTokens: null, generationMilliseconds: null, tokensPerSecond: null,
    residentMemoryBytes: 4096, memorySamples: 4, vramBytes: 0,
    provenance: { residentMemory: "linux-proc-vmrss", vram: "policy-cpu-disabled" } } });
  expect(result.telemetry.unavailableReasons).toEqual(["time-to-first-token:not-applicable-transcription", "tokens-per-second:not-applicable-transcription"]);
  expect(result.latencyMilliseconds).toBeNumber(); expect(argumentsList[0]).toContain("--no-gpu");
  expect(await runtime.transcribe("loaded", "normal", audio, "es", new AbortController().signal)).toBe("Useful speech");
  expect(argumentsList[1]).not.toContain("--no-gpu"); expect(memoryCalls).toBe(1); expect(stopped).toBe(2);
});
