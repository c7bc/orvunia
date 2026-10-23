import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createNativeRepositoryPreparation } from "../../packages/desktop/repository-preparation.ts";
import { createNativeRepositoryHandler } from "../../packages/desktop/repository-handlers.ts";
import { nativeRepositoryLocations } from "../../packages/desktop/repository-locations.ts";

async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "orvunia-repository-connection-"));
  try {
    await mkdir(join(root, "src")); await mkdir(join(root, "tests"));
    await writeFile(join(root, "src/app.ts"), "export const version = 1;");
    await writeFile(join(root, "src/private-key.ts"), "DO_NOT_INCLUDE");
    await writeFile(join(root, ".env"), "DO_NOT_INCLUDE");
    await writeFile(join(root, "tests/app.test.ts"), "export const example = true;");
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

function setup(root: string, origin = "https://owned.example") {
  const identity = { workspaceId: "workspace", actorId: "actor", modeId: "technical" };
  const session = { sessionId: crypto.randomUUID(), active: true };
  let canceled = false, picks = 0, onBinding: (() => Promise<void>) | null = null;
  const locations = nativeRepositoryLocations(join(root, "locations.json"), () => origin);
  const signal = new AbortController();
  const preparation = createNativeRepositoryPreparation({ interactive() {}, signal: signal.signal, locations,
    identity: async () => identity, session: async () => ({ ...identity, sessionId: session.sessionId }),
    activeSession: () => session.active ? session.sessionId : null,
    choose: async () => { picks++; return { canceled, filePaths: [root] }; } });
  const owner = () => ({ workspaceId: identity.workspaceId, actorId: identity.actorId, sessionId: session.sessionId });
  const handler = createNativeRepositoryHandler({ interactive() {}, signal: signal.signal,
    activeSession: () => session.active ? session.sessionId : null,
    binding: async () => { await onBinding?.(); return owner(); },
    prepared: preparation.selection, choose: async () => { picks++; return { canceled, filePaths: [root] }; } });
  const select = (notice = true, scope = ["src", "tests"]) => preparation.invoke("panel", {
    preparation: "select", modeId: "technical", scope, ...(notice ? { noticeVersion: 1 } : {}) });
  const status = () => preparation.invoke("panel", { preparation: "status", modeId: "technical" });
  const connect = async () => {
    const value = await handler.invoke("overlay", { action: "select-prepared", ...owner(), modeId: "technical" }) as {
      grantId: string; revision: number; snapshotSha256: string; approved: boolean };
    const binding = { ...owner(), grantId: value.grantId, revision: value.revision, snapshotSha256: value.snapshotSha256 };
    return { value, binding, read: () => handler.invoke("overlay", { ...binding, action: "read",
      path: "src/app.ts", fromLine: 1, toLine: 1 }) };
  };
  return { identity, session, locations, preparation, handler, owner, select, status, connect,
    interceptBinding(callback: () => Promise<void>) { onBinding = callback; },
    cancelPicker() { canceled = true; }, picks: () => picks,
    close() { signal.abort(); handler.close(); preparation.close(); } };
}

test("selection with the visible notice authorizes session reads without a second approval; filters and files survive", () => fixture(async root => {
  const value = setup(root);
  try {
    expect(await value.select()).toMatchObject({ authorized: true, preview: { approved: false } });
    const connected = await value.connect();
    expect(connected.value.approved).toBe(true);
    expect(await connected.read()).toMatchObject({ text: "export const version = 1;" });
    const files = await value.handler.invoke("overlay", { ...connected.binding, action: "list" });
    expect(JSON.stringify(files)).toContain("tests/app.test.ts");
    expect(JSON.stringify(files)).not.toContain("private-key");
    expect(JSON.stringify(files)).not.toContain(root);
    expect(await readFile(join(root, "src/app.ts"), "utf8")).toBe("export const version = 1;");
    expect(await readFile(join(root, ".env"), "utf8")).toBe("DO_NOT_INCLUDE");
    value.session.active = false;
    await expect(connected.read()).rejects.toThrow("repository_session_changed");
  } finally { value.close(); }
}));

test("authorization survives restart for the same origin and mode while sessions receive fresh scoped grants", () => fixture(async root => {
  const first = setup(root); await first.select(); first.close();
  const stored = await readFile(join(root, "locations.json"), "utf8");
  expect(stored).toContain('"authorization":{"version":1');
  expect(stored).not.toContain("grantId"); expect(stored).not.toContain("export const");
  await writeFile(join(root, "src/app.ts"), "export const version = 2;");
  const second = setup(root), elsewhere = setup(root, "https://different.example");
  try {
    expect(await elsewhere.status()).toBeNull();
    expect(await second.status()).toMatchObject({ authorized: true });
    const connected = await second.connect();
    expect(connected.value.approved).toBe(true);
    expect(await connected.read()).toMatchObject({ text: "export const version = 2;" });
    expect(second.picks()).toBe(0);
    second.identity.actorId = "another";
    await expect(connected.read()).rejects.toThrow("repository_identity_changed");
  } finally { second.close(); elsewhere.close(); }
}));

test("refresh uses the same authorization and filters, invalidates old revisions, and never changes source files", () => fixture(async root => {
  const value = setup(root);
  try {
    await value.select(); const connected = await value.connect();
    await writeFile(join(root, "src/app.ts"), "export const version = 3;");
    const refreshed = await value.handler.invoke("overlay", { ...connected.binding, action: "refresh" }) as {
      revision: number; snapshotSha256: string; approved: boolean };
    expect(refreshed.approved).toBe(true);
    await expect(connected.read()).rejects.toThrow("repository_revision_changed");
    const read = await value.handler.invoke("overlay", { ...connected.binding, revision: refreshed.revision,
      snapshotSha256: refreshed.snapshotSha256, action: "read", path: "src/app.ts", fromLine: 1, toLine: 1 });
    expect(read).toMatchObject({ text: "export const version = 3;" });
    expect(JSON.stringify(refreshed)).not.toContain("private-key");
  } finally { value.close(); }
}));

test("disconnect and reconnect with another scope revoke existing session access without expanding it", () => fixture(async root => {
  const value = setup(root);
  try {
    await value.select(); const first = await value.connect();
    await value.preparation.invoke("panel", { preparation: "remove", modeId: "technical" });
    await expect(first.read()).rejects.toThrow("repository_consent_required");
    expect(await value.status()).toBeNull();
    await value.select(); const second = await value.connect();
    await value.select(true, ["tests"]);
    await expect(second.read()).rejects.toThrow("repository_consent_required");
    const third = await value.connect();
    expect(third.value.approved).toBe(true);
    expect(await third.read()).toMatchObject({ error: { code: "repository_file_not_found" } });
  } finally { value.close(); }
}));

test("canceling the picker preserves the prior connection and legacy locations are not silently authorized", () => fixture(async root => {
  const value = setup(root);
  try {
    await value.select(false); const before = await readFile(join(root, "locations.json"), "utf8");
    expect(await value.status()).toMatchObject({ authorized: false });
    const legacy = await value.connect(); expect(legacy.value.approved).toBe(false);
    await expect(legacy.read()).rejects.toThrow("repository_consent_required");
    value.cancelPicker(); expect(await value.select()).toEqual({ canceled: true });
    expect(await readFile(join(root, "locations.json"), "utf8")).toBe(before);
    expect(await value.status()).toMatchObject({ authorized: false });
  } finally { value.close(); }
}));

test("disconnect during the final asynchronous identity check blocks the pending file read", () => fixture(async root => {
  const value = setup(root);
  try {
    await value.select(); const connected = await value.connect();
    let checks = 0;
    value.interceptBinding(async () => {
      if (++checks === 2) await value.preparation.invoke("panel", { preparation: "remove", modeId: "technical" });
    });
    await expect(connected.read()).rejects.toThrow("repository_consent_required");
    expect(await value.status()).toBeNull();
  } finally { value.close(); }
}));
