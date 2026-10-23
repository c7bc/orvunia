import { expect, test } from "bun:test";
import { repositoryModelEvidence } from "../../packages/repository-agent/evidence.ts";

test("source reads keep exact original offsets and metadata without asking the model to count lines", () => {
  const original = { path: "src/example.ts", fromLine: 47, toLine: 49, sha256: "a".repeat(64),
    revision: 3, text: "function sample() {\r\n  return 1;\r\n}" };
  const raw = JSON.stringify(original);
  const result = JSON.parse(repositoryModelEvidence(raw));
  expect(result).toEqual({ path: original.path, fromLine: 47, toLine: 49, sha256: original.sha256, revision: 3,
    sourceLines: [{ line: 47, text: "function sample() {" }, { line: 48, text: "  return 1;" }, { line: 49, text: "}" }] });
  expect(JSON.parse(raw)).toEqual(original);
});

test("lists, searches, typed tool errors and malformed evidence remain unchanged", () => {
  for (const output of ["not-json", "null", "[]", '{"error":{"code":"repository_file_not_found"}}',
    '{"files":[{"path":"src/example.ts"}]}', '{"matches":[{"line":47,"text":"sample"}]}',
    '{"path":"src/example.ts","fromLine":0,"toLine":1,"text":"x"}',
    '{"path":"src/example.ts","fromLine":1,"toLine":3,"text":"x"}'])
    expect(repositoryModelEvidence(output)).toBe(output);
});
