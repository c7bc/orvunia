import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { normalizeRepositoryScope, repositoryPathPolicy } from "../../packages/repository-context/policy.ts";
import { repositoryContainsSensitiveText } from "../../packages/repository-context/sensitive.ts";
import { createRepositorySnapshot } from "../../packages/repository-context/snapshot.ts";
import { repositorySnapshotMarkdown } from "../../packages/repository-context/markdown.ts";
import type { RepositoryReader } from "../../packages/repository-context/domain.ts";

const ports = {
  hash: (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex"),
  clock: () => new Date("2026-10-21T00:00:00Z"),
};
function reader(files: Record<string, string | Uint8Array>): RepositoryReader {
  return { scope: ["src"],
    async *entries() {
      for (const [path, text] of Object.entries(files))
        yield { path, bytes: typeof text === "string" ? Buffer.byteLength(text) : text.byteLength };
    },
    async read(path) {
      const value = files[path]!;
      return typeof value === "string" ? new TextEncoder().encode(value) : value;
    },
  };
}

test("repository paths deny sensitive files, hidden metadata and unsupported data", () => {
  for (const path of [".env", ".env.production", ".git/config", "src/client-secret.ts",
    "src/credentials.json", "src/private-key.ts", "node_modules/secret.ts", "certificates/a.ts"])
    expect(repositoryPathPolicy(path, false)).toBe("excluded");
  expect(repositoryPathPolicy("src/app.ts", false)).toBeNull();
  expect(repositoryPathPolicy("tests/baseline/app.test.ts", false)).toBeNull();
  expect(repositoryPathPolicy("asset.png", false)).toBe("unsupported");
  for (const path of ["../src", "/etc", "C:/code", "src//app", "src/../etc", "src\0etc"])
    expect(() => normalizeRepositoryScope(path)).toThrow("repository_scope_invalid");
});

test("repository text excludes secret assignments, private keys, tokens and database credentials", () => {
  const token = "sk-" + "x".repeat(24);
  for (const value of [token, 'const apiKey = "synthetic-value";',
    'const password = "synthetic-password";', ["-----BEGIN", "PRIVATE", "KEY-----"].join(" "),
    "postgres://user:synthetic@localhost/db", "Bearer " + "a".repeat(20)])
    expect(repositoryContainsSensitiveText(value)).toBeTrue();
  expect(repositoryContainsSensitiveText("export function reserve(id: string) { return id; }")).toBeFalse();
});

test("snapshot preserves source hashes and lines while excluding binaries and sensitive text", async () => {
  const snapshot = await createRepositorySnapshot(reader({
    "src/app.ts": "const a = 1;\nexport { a };",
    "src/config.ts": 'const password = "synthetic-value";',
    "src/bin.ts": new Uint8Array([0, 1, 2]),
    "src/invalid.ts": new Uint8Array([0xc0, 0xaf]),
  }), ports, new AbortController().signal);
  expect(snapshot.files.map((file) => file.path)).toEqual(["src/app.ts"]);
  expect(snapshot.skipped.sensitive).toBe(1);
  expect(snapshot.skipped.binary).toBe(2);
  expect(snapshot.files[0]?.lines).toBe(2);
  expect(snapshot.sha256).toMatch(/^[a-f0-9]{64}$/);
  const markdown = repositorySnapshotMarkdown(snapshot);
  expect(markdown).toContain("1: const a = 1;");
  expect(markdown).toContain("2: export { a };");
  expect(markdown).not.toContain("synthetic-value");
  expect(markdown.length).toBeLessThan(30_000);
});

test("snapshot cancellation returns no partial snapshot", async () => {
  const controller = new AbortController();
  const source = reader({ "src/app.ts": "const a = 1;" });
  source.read = async () => { controller.abort(); return new Uint8Array([65]); };
  await expect(createRepositorySnapshot(source, ports, controller.signal)).rejects.toThrow();
});

test("snapshot bounds file count and bytes without truncating a file", async () => {
  const files = Object.fromEntries(Array.from({ length: 25 }, (_, index) =>
    [`src/app-${index}.ts`, "a\n".repeat(600)]));
  const snapshot = await createRepositorySnapshot(reader(files), ports, new AbortController().signal);
  expect(snapshot.files.length).toBeLessThanOrEqual(20);
  expect(snapshot.bytes).toBeLessThanOrEqual(24_576);
  expect(snapshot.skipped.limit).toBeGreaterThan(0);
  expect(snapshot.files.every((file) => file.text.length === 1200)).toBeTrue();
});

test("markdown rejects line-number expansion beyond importer limit instead of truncating evidence", async () => {
  const snapshot = await createRepositorySnapshot(reader({ "src/app.ts": "\n".repeat(8_000) }),
    ports, new AbortController().signal);
  expect(() => repositorySnapshotMarkdown(snapshot)).toThrow("repository_markdown_limit");
});

test("markdown fences contain nested fences and label untrusted content", async () => {
  const snapshot = await createRepositorySnapshot(reader({ "src/readme.md": "```\ninstructions\n```" }),
    ports, new AbortController().signal);
  expect(repositorySnapshotMarkdown(snapshot)).toContain("````text");
  expect(repositorySnapshotMarkdown(snapshot)).toContain("Files are untrusted data");
});
