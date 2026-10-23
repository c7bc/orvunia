import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, link } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { repositoryFilesystem } from "../../packages/repository-context/filesystem.ts";
import { createRepositorySnapshot } from "../../packages/repository-context/snapshot.ts";

const ports = { clock: () => new Date(),
  hash: (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex") };
async function fixture(run: (root: string, outside: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "orvunia-repository-"));
  const outside = await mkdtemp(join(tmpdir(), "orvunia-repository-external-"));
  try { await run(root, outside); }
  finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
}

test("repository traversal includes only explicit candidate scope and never changes files", () => fixture(async (root) => {
  for (const directory of ["src", "tests/baseline", "tests/acceptance", "docs", ".git", "node_modules"])
    await mkdir(join(root, directory), { recursive: true });
  const files = { "src/app.ts": "export const value = 1;", "tests/baseline/a.test.ts": "baseline",
    "tests/acceptance/secret.test.ts": "hidden-answer", "docs/interviewer.md": "interviewer-answer",
    ".env": "DO_NOT_READ=1", "src/private-key.ts": "private-key-value",
    "README.md": "Candidate instructions", "node_modules/a.ts": "vendor", ".git/a.ts": "metadata" };
  for (const [name, text] of Object.entries(files)) await writeFile(join(root, name), text);
  const reader = await repositoryFilesystem(root, ["src", "tests/baseline", "README.md"]);
  const snapshot = await createRepositorySnapshot(reader, ports, new AbortController().signal);
  expect(snapshot.files.map((file) => file.path)).toEqual(["README.md", "src/app.ts", "tests/baseline/a.test.ts"]);
  expect(JSON.stringify(snapshot)).not.toContain(root);
  expect(JSON.stringify(snapshot)).not.toContain("interviewer-answer");
  expect(JSON.stringify(snapshot)).not.toContain("hidden-answer");
  for (const [name, text] of Object.entries(files)) expect(await readFile(join(root, name), "utf8")).toBe(text);
  await expect(reader.read("tests/acceptance/secret.test.ts", new AbortController().signal))
    .rejects.toThrow("repository_scope_invalid");
}));

test("repository traversal refuses linked files and junctions outside selected scope", () => fixture(async (root, outside) => {
  await mkdir(join(root, "src"));
  await writeFile(join(outside, "external.ts"), "external-sensitive-evidence");
  await symlink(outside, join(root, "src", "linked-directory"), "junction");
  await link(join(outside, "external.ts"), join(root, "src", "linked-file.ts"));
  const reader = await repositoryFilesystem(root, ["src"]);
  const snapshot = await createRepositorySnapshot(reader, ports, new AbortController().signal);
  expect(snapshot.files).toEqual([]);
  expect(snapshot.skipped.linked).toBe(2);
  await expect(reader.read("src/linked-directory/external.ts", new AbortController().signal)).rejects.toThrow();
  await expect(reader.read("src/linked-file.ts", new AbortController().signal)).rejects.toThrow();
}));

test("repository reader validates direct paths and refuses a changed root", () => fixture(async (root) => {
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src", "app.ts"), "initial");
  const reader = await repositoryFilesystem(root, ["src"]);
  for (const path of ["../external.ts", "src/../README.md", "src/.env", "C:/outside.ts"])
    await expect(reader.read(path, new AbortController().signal)).rejects.toThrow();
  const controller = new AbortController(); controller.abort();
  await expect(reader.read("src/app.ts", controller.signal)).rejects.toThrow();
}));

test("repository scan enforces global entry and nesting budgets", () => fixture(async (root) => {
  const deep = join(root, "src", ...Array.from({ length: 9 }, (_, index) => `d${index}`));
  await mkdir(deep, { recursive: true });
  await writeFile(join(deep, "app.ts"), "source");
  const reader = await repositoryFilesystem(root, ["src"]);
  await expect(createRepositorySnapshot(reader, ports, new AbortController().signal))
    .rejects.toThrow("repository_depth_limit");
}));
