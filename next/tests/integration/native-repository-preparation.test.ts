import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeRepositoryPreparation } from "../../packages/desktop/repository-preparation.ts";
import { createNativeRepositoryHandler } from "../../packages/desktop/repository-handlers.ts";

async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "orvunia-mode-repository-"));
  try {
    await mkdir(join(root, "src")); await writeFile(join(root, "src", "app.ts"), "export const version = 1;");
    await writeFile(join(root, ".env"), "SYNTHETIC_SECRET=not-an-actual-credential");
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
test("mode preparation needs no session, keeps root private and re-reads a fresh unapproved session snapshot", () => fixture(async root => {
  const identity = { workspaceId: "workspace", actorId: "actor", modeId: "technical" };
  const sessionId = crypto.randomUUID(); let active: string | null = null, picks = 0;
  const preparation = createNativeRepositoryPreparation({ interactive() {}, signal: new AbortController().signal,
    identity: async () => identity, session: async () => ({ ...identity, sessionId }), activeSession: () => active,
    choose: async () => { picks++; return { canceled: false, filePaths: [root] }; } });
  const value = await preparation.invoke("panel", { preparation: "select", modeId: "technical", scope: ["src"] });
  expect(value).toMatchObject({ modeId: "technical", preview: { approved: false } });
  expect(JSON.stringify(value)).not.toContain(root);
  expect(JSON.stringify(value)).not.toContain("SYNTHETIC_SECRET");
  await writeFile(join(root, "src", "app.ts"), "export const version = 2;");
  const owner = { workspaceId: identity.workspaceId, actorId: identity.actorId, sessionId, windowId: "overlay" };
  await expect(preparation.selection(owner, "technical")).rejects.toThrow("repository_session_changed");
  active = sessionId;
  const handler = createNativeRepositoryHandler({ interactive() {}, signal: new AbortController().signal,
    activeSession: () => active, binding: async () => ({ workspaceId: owner.workspaceId, actorId: owner.actorId, sessionId }),
    prepared: preparation.selection, choose: async () => { throw Error("Picker must not reopen"); } });
  const result = await handler.invoke("overlay", { action: "select-prepared", workspaceId: owner.workspaceId,
    actorId: owner.actorId, sessionId, modeId: "technical" }) as { grantId: string; revision: number; snapshotSha256: string };
  const selected = { grantId: result.grantId, revision: result.revision, snapshotSha256: result.snapshotSha256 };
  const preview = await handler.invoke("overlay", { action: "preview", workspaceId: owner.workspaceId,
    actorId: owner.actorId, sessionId, ...selected });
  expect(preview).toMatchObject({ approved: false });
  expect(JSON.stringify(preview)).toContain("version = 2");
  await expect(handler.invoke("overlay", { action: "read", workspaceId: owner.workspaceId,
    actorId: owner.actorId, sessionId, ...selected, path: "src/app.ts", fromLine: 1, toLine: 1 }))
    .rejects.toThrow("repository_consent_required");
  await handler.invoke("overlay", { action: "approve", workspaceId: owner.workspaceId,
    actorId: owner.actorId, sessionId, ...selected, consent: true });
  expect(await handler.invoke("overlay", { action: "read", workspaceId: owner.workspaceId,
    actorId: owner.actorId, sessionId, ...selected, path: "src/app.ts", fromLine: 1, toLine: 1 }))
    .toMatchObject({ text: "export const version = 2;" });
  expect(picks).toBe(1); handler.close(); preparation.close();
}));

test("prepared folders are isolated by actor, workspace and exact mode, and cannot accept renderer paths", () => fixture(async root => {
  let actorId = "actor", workspaceId = "workspace", sessionMode = "technical";
  const sessionId = crypto.randomUUID();
  const preparation = createNativeRepositoryPreparation({ interactive() {}, signal: new AbortController().signal,
    activeSession: () => sessionId, identity: async modeId => ({ workspaceId, actorId, modeId }),
    session: async () => ({ workspaceId, actorId, modeId: sessionMode, sessionId }),
    choose: async () => ({ canceled: false, filePaths: [root] }) });
  await preparation.invoke("panel", { preparation: "select", modeId: "technical", scope: ["src"] });
  actorId = "other";
  expect(await preparation.invoke("panel", { preparation: "status", modeId: "technical" })).toBeNull();
  actorId = "actor"; workspaceId = "other";
  expect(await preparation.invoke("panel", { preparation: "status", modeId: "technical" })).toBeNull();
  workspaceId = "workspace";
  expect(await preparation.invoke("panel", { preparation: "status", modeId: "custom" })).toBeNull();
  const owner = { workspaceId, actorId, sessionId, windowId: "overlay" };
  sessionMode = "custom";
  await expect(preparation.selection(owner, "technical")).rejects.toThrow("repository_identity_changed");
  await expect(preparation.invoke("panel", { preparation: "select", modeId: "technical", scope: ["src"], root }))
    .rejects.toThrow();
  await preparation.invoke("panel", { preparation: "remove", modeId: "technical" });
  expect(await preparation.invoke("panel", { preparation: "status", modeId: "technical" })).toBeNull();
  preparation.close();
}));

test("remove cancels a pending preparation and a late picker cannot restore it", () => fixture(async root => {
  const identity = { workspaceId: "workspace", actorId: "actor", modeId: "technical" };
  let finish!: (value: { canceled: boolean; filePaths: string[] }) => void, opened!: () => void;
  const ready = new Promise<void>(resolve => { opened = resolve; });
  const selection = new Promise<{ canceled: boolean; filePaths: string[] }>(resolve => { finish = resolve; });
  const preparation = createNativeRepositoryPreparation({ interactive() {}, signal: new AbortController().signal,
    identity: async () => identity, session: async () => ({}), activeSession: () => null,
    choose: () => { opened(); return selection; } });
  const pending = preparation.invoke("panel", { preparation: "select", modeId: "technical", scope: ["src"] });
  await ready;
  await preparation.invoke("panel", { preparation: "remove", modeId: "technical" });
  await expect(pending).rejects.toThrow();
  finish({ canceled: false, filePaths: [root] });
  expect(await preparation.invoke("panel", { preparation: "status", modeId: "technical" })).toBeNull();
  preparation.close();
}));

test("identity changes during selection and shutdown prevent storing a prepared folder", () => fixture(async root => {
  const signal = new AbortController(); let actorId = "actor";
  const preparation = createNativeRepositoryPreparation({ interactive() {}, signal: signal.signal,
    identity: async modeId => ({ workspaceId: "workspace", actorId, modeId }), session: async () => ({}), activeSession: () => null,
    choose: async () => { actorId = "other"; return { canceled: false, filePaths: [root] }; } });
  await expect(preparation.invoke("panel", { preparation: "select", modeId: "technical", scope: ["src"] }))
    .rejects.toThrow("repository_identity_changed");
  expect(await preparation.invoke("panel", { preparation: "status", modeId: "technical" })).toBeNull();
  signal.abort();
  await expect(preparation.invoke("panel", { preparation: "status", modeId: "technical" })).rejects.toThrow();
  preparation.close();
}));

test("removing preparation during final identity validation prevents late snapshot installation", () => fixture(async root => {
  const identity = { workspaceId: "workspace", actorId: "actor", modeId: "technical" };
  let checks = 0, finish!: () => void, ready!: () => void;
  const entered = new Promise<void>(resolve => { ready = resolve; });
  const released = new Promise<void>(resolve => { finish = resolve; });
  const preparation = createNativeRepositoryPreparation({ interactive() {}, signal: new AbortController().signal,
    async identity() { if (++checks === 3) { ready(); await released; } return identity; },
    session: async () => ({}), activeSession: () => null,
    choose: async () => ({ canceled: false, filePaths: [root] }) });
  const selecting = preparation.invoke("panel", { preparation: "select", modeId: "technical", scope: ["src"] });
  await entered;
  await preparation.invoke("panel", { preparation: "remove", modeId: "technical" });
  finish();
  await expect(selecting).rejects.toThrow("repository_cancelled");
  expect(await preparation.invoke("panel", { preparation: "status", modeId: "technical" })).toBeNull();
  preparation.close();
}));

test("renderer shutdown cancels its own picker without network or interactive access", () => fixture(async root => {
  const identity = { workspaceId: "workspace", actorId: "actor", modeId: "technical" };
  let closing = false, finish!: (value: { canceled: boolean; filePaths: string[] }) => void, ready!: () => void;
  const entered = new Promise<void>(resolve => { ready = resolve; });
  const picker = new Promise<{ canceled: boolean; filePaths: string[] }>(resolve => { finish = resolve; });
  const preparation = createNativeRepositoryPreparation({ interactive() { if (closing) throw Error("closing"); },
    signal: new AbortController().signal, identity: async () => { if (closing) throw Error("network unavailable"); return identity; },
    session: async () => ({}), activeSession: () => null, choose: () => { ready(); return picker; } });
  const selecting = preparation.invoke("panel", { preparation: "select", modeId: "technical", scope: ["src"] });
  await entered; closing = true;
  expect(await preparation.invoke("overlay", { preparation: "cancel", modeId: "technical" })).toEqual({ canceled: true });
  expect(await preparation.invoke("panel", { preparation: "cancel", modeId: "technical" })).toEqual({ canceled: true });
  await expect(selecting).rejects.toThrow(); finish({ canceled: false, filePaths: [root] });
  closing = false;
  expect(await preparation.invoke("panel", { preparation: "status", modeId: "technical" })).toBeNull();
  preparation.close();
}));
