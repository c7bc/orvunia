import { expect, test } from "bun:test";
import { catalogModels } from "../../../client/models/decoder.ts";
const model = { id: "synthetic", revision: "a".repeat(40), name: "Synthetic model", source: "https://example.test/model",
  evaluation: "not-verified", maximumContext: 2048, capabilities: ["text"], files: [{ bytes: 1024 }] };

test("model decoder preserves declared metadata without inventing omitted license or format", () => {
  const metadata = { format: "gguf", quantization: "Q4_K_M", license: { name: "MIT", url: "https://example.test/LICENSE" } };
  expect(catalogModels({ models: [{ ...model, ...metadata }] })[0]).toMatchObject(metadata);
  const absent = catalogModels({ models: [model] })[0];
  expect(absent).not.toHaveProperty("license"); expect(absent).not.toHaveProperty("format");
  expect(absent).not.toHaveProperty("quantization");
});

test("model decoder rejects malformed declared metadata", () => {
  for (const metadata of [{ format: 42 }, { quantization: {} }, { license: { name: "MIT", url: 42 } }])
    expect(() => catalogModels({ models: [{ ...model, ...metadata }] })).toThrow("Resposta inválida");
});
