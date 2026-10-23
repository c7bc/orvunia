import { expect, test } from "bun:test";
import { llamaProcessArguments } from "../../packages/local-models/llama.ts";
import type { RuntimeLoad } from "../../packages/local-models/runtime.ts";
import { syntheticManifest } from "../support/local-models.ts";

function settings(contextTokens = 4096): RuntimeLoad {
  return { installationId: crypto.randomUUID(), manifest: syntheticManifest(),
    files: [{ role: "weights", path: "weights with spaces.gguf" }],
    contextTokens, maximumOutputTokens: 128, threads: 4 };
}
const value = (argumentsList: string[], flag: string) => argumentsList[argumentsList.indexOf(flag) + 1];

test("a runtime admitting one operation reserves one server slot and bounded CPU batches", () => {
  const argumentsList = llamaProcessArguments(settings(), "weights with spaces.gguf", 19919, "private key.file", "owned-alias");
  expect(value(argumentsList, "--parallel")).toBe("1");
  expect(value(argumentsList, "--batch-size")).toBe("256");
  expect(value(argumentsList, "--ubatch-size")).toBe("128");
  expect(value(argumentsList, "--host")).toBe("127.0.0.1");
  expect(value(argumentsList, "--n-gpu-layers")).toBe("0");
  expect(value(argumentsList, "--api-key-file")).toBe("private key.file");
  expect(value(argumentsList, "-m")).toBe("weights with spaces.gguf");
  expect(argumentsList).not.toContain("--no-warmup");
});

test("small contexts do not request batches larger than their context", () => {
  const argumentsList = llamaProcessArguments(settings(64), "weights", 19919, "key", "alias");
  expect(value(argumentsList, "--batch-size")).toBe("64");
  expect(value(argumentsList, "--ubatch-size")).toBe("64");
});

test("CPU vision keeps the verified projector and disables implicit GPU offload", () => {
  const configuration = settings();
  configuration.files.push({ role: "projector", path: "verified projector.gguf" });
  const argumentsList = llamaProcessArguments(configuration, "weights", 19919, "key", "alias");
  expect(value(argumentsList, "--mmproj")).toBe("verified projector.gguf");
  expect(argumentsList).toContain("--no-mmproj-offload");
});
