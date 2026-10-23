import { expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import { createRepositoryContext } from "../../packages/repository-context/service.ts";
import type { RepositoryReader } from "../../packages/repository-context/domain.ts";
import type { RepositoryOwner } from "../../packages/repository-context/grants.ts";

const owner: RepositoryOwner = { workspaceId: "workspace", actorId: "actor", sessionId: randomUUID(), windowId: "1" };
function setup() {
  let text = "export const value = 1;\nexport const second = 2;";
  let now = Date.now();
  const reader: RepositoryReader = { scope: ["src"],
    async *entries() { yield { path: "src/app.ts", bytes: Buffer.byteLength(text) }; },
    async read() { return new TextEncoder().encode(text); } };
  const service = createRepositoryContext({ clock: () => new Date(now), identifier: randomUUID,
    hash: (bytes) => createHash("sha256").update(bytes).digest("hex"), open: async () => reader });
  return { service, setText: (value: string) => { text = value; },
    advance: (milliseconds: number) => { now += milliseconds; }, reader };
}

test("repository grant requires explicit approval before tools and exposes no local root", async () => {
  const { service } = setup();
  const preview = await service.select(owner, "C:/private-root", ["src"], new AbortController().signal);
  expect(preview.approved).toBeFalse();
  expect(JSON.stringify(preview)).not.toContain("private-root");
  expect(() => service.list(owner, preview)).toThrow("repository_consent_required");
  expect(service.preview(owner, preview).markdown).toContain("1: export const value");
  service.approve(owner, preview, true);
  expect(service.list(owner, preview).files).toHaveLength(1);
  expect(service.read(owner, preview, { path: "src/app.ts", fromLine: 2, toLine: 2 }).text)
    .toBe("export const second = 2;");
  expect(service.read(owner, preview, { path: "src/app.ts", fromLine: 1, toLine: 200 }))
    .toMatchObject({ fromLine: 1, toLine: 2, text: "export const value = 1;\nexport const second = 2;" });
  expect(() => service.read(owner, preview, { path: "src/app.ts", fromLine: 3, toLine: 200 }))
    .toThrow("repository_line_range_invalid");
  expect(service.search(owner, preview, { query: "SECOND" }).matches[0]?.line).toBe(2);
  expect(service.search(owner, preview, { query: ".*" }).matches).toEqual([]);
  service.close();
});

test("repository grants bind actor, workspace, session and native window", async () => {
  const { service } = setup();
  const grant = await service.select(owner, "root", ["src"], new AbortController().signal);
  service.approve(owner, grant, true);
  for (const key of ["workspaceId", "actorId", "sessionId", "windowId"] as const)
    expect(() => service.list({ ...owner, [key]: "other" }, grant)).toThrow("repository_grant_not_found");
  expect(() => service.read(owner, grant, { path: "../secret.ts", fromLine: 1, toLine: 1 }))
    .toThrow("repository_file_not_found");
  expect(() => service.read(owner, grant, { path: "src/app.ts", fromLine: 1, toLine: 300 }))
    .toThrow("repository_line_range_invalid");
  service.close();
});

test("refresh tracks changed files and invalidates approval and stale tool revisions", async () => {
  const { service, setText } = setup();
  const grant = await service.select(owner, "root", ["src"], new AbortController().signal);
  service.approve(owner, grant, true);
  setText("export const changed = 3;");
  const updated = await service.refresh(owner, grant, new AbortController().signal);
  expect(updated.revision).toBe(2);
  expect(updated.snapshotSha256).not.toBe(grant.snapshotSha256);
  expect(updated.changes.modified).toEqual(["src/app.ts"]);
  expect(() => service.list(owner, grant)).toThrow("repository_revision_changed");
  expect(() => service.list(owner, updated)).toThrow("repository_consent_required");
  service.approve(owner, updated, true);
  expect(service.read(owner, updated, { path: "src/app.ts", fromLine: 1, toLine: 1 }).text)
    .toContain("changed");
  service.close();
});

test("failed refresh preserves old evidence but revokes consent", async () => {
  const { service, reader } = setup();
  const grant = await service.select(owner, "root", ["src"], new AbortController().signal);
  service.approve(owner, grant, true);
  reader.read = async () => { throw Error("changed"); };
  await expect(service.refresh(owner, grant, new AbortController().signal)).rejects.toThrow();
  expect(service.preview(owner, grant).markdown).toContain("value = 1");
  expect(() => service.list(owner, grant)).toThrow("repository_consent_required");
  service.close();
});

test("approval lasts for the entire session regardless of elapsed time", async () => {
  const { service, advance } = setup();
  const grant = await service.select(owner, "root", ["src"], new AbortController().signal);
  service.approve(owner, grant, true);
  expect(grant).not.toHaveProperty("expiresAt");
  for (const elapsed of [15 * 60_000, 3 * 60 * 60_000, 2 * 24 * 60 * 60_000]) {
    advance(elapsed);
    expect(service.list(owner, grant).approved).toBeTrue();
    expect(service.read(owner, grant, { path: "src/app.ts", fromLine: 1, toLine: 1 }).text).toContain("value");
    expect(service.search(owner, grant, { query: "second" }).matches).toHaveLength(1);
  }
  const otherOwner = { ...owner, sessionId: randomUUID() };
  await service.select(otherOwner, "other-root", ["src"], new AbortController().signal);
  expect(service.list(owner, grant).approved).toBeTrue();
  service.close();
});

test("manual revocation and session shutdown still invalidate long-lived approvals", async () => {
  const { service, advance } = setup();
  const grant = await service.select(owner, "root", ["src"], new AbortController().signal);
  service.approve(owner, grant, true);
  advance(3 * 60 * 60_000);
  service.revoke(owner, grant.grantId);
  expect(() => service.list(owner, grant)).toThrow("repository_grant_not_found");
  const next = await service.select(owner, "root", ["src"], new AbortController().signal);
  service.approve(owner, next, true);
  service.revokeOwner(owner);
  expect(() => service.preview(owner, next)).toThrow("repository_grant_not_found");
  const final = await service.select(owner, "root", ["src"], new AbortController().signal);
  service.approve(owner, final, true);
  service.close();
  expect(() => service.preview(owner, final)).toThrow("repository_grant_not_found");
  await expect(service.select(owner, "root", ["src"], new AbortController().signal))
    .rejects.toThrow("repository_closed");
});

test("cancelled selection never installs a grant", async () => {
  const { service, reader } = setup();
  let reading: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { reading = resolve; });
  reader.read = async (_path, signal) => {
    reading!();
    await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    signal.throwIfAborted(); return new Uint8Array();
  };
  const pending = service.select(owner, "root", ["src"], new AbortController().signal);
  await started;
  service.revokeOwner(owner);
  await expect(pending).rejects.toThrow();
  service.close();
});
