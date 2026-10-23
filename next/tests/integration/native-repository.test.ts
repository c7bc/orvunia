import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createNativeRepositoryHandler } from "../../packages/desktop/repository-handlers.ts";

async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "orvunia-native-repository-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "app.ts"), "export const value = 1;");
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("native folder grant validates identity around picker, keeps path private and gates reads", () => fixture(async (root) => {
  const identity = { workspaceId: "workspace", actorId: "actor", sessionId: randomUUID() };
  let checked = 0, picked = 0;
  const handler = createNativeRepositoryHandler({ interactive() {}, signal: new AbortController().signal,
    activeSession: () => identity.sessionId,
    choose: async () => { picked++; return { canceled: false, filePaths: [root] }; },
    binding: async () => { checked++; return identity; } });
  const value = await handler.invoke("1", { action: "select", ...identity, scope: ["src"] });
  const preview = value as { grantId: string; revision: number; snapshotSha256: string };
  expect(checked).toBe(4);
  expect(picked).toBe(1);
  expect(JSON.stringify(preview)).not.toContain(root);
  const binding = { grantId: preview.grantId, revision: preview.revision, snapshotSha256: preview.snapshotSha256 };
  await expect(handler.invoke("1", { action: "read", ...identity, ...binding,
    path: "src/app.ts", fromLine: 1, toLine: 1 })).rejects.toThrow("repository_consent_required");
  await handler.invoke("1", { action: "approve", ...identity, ...binding, consent: true });
  expect(await handler.invoke("1", { action: "read", ...identity, ...binding,
    path: "src/app.ts", fromLine: 1, toLine: 1 })).toMatchObject({ text: "export const value = 1;" });
  await expect(handler.invoke("2", { action: "list", ...identity, ...binding }))
    .rejects.toThrow("repository_grant_not_found");
  await expect(handler.invoke("1", { action: "select", ...identity, scope: ["src"], root }))
    .rejects.toThrow("repository_command_invalid");
  handler.close();
}));

test("changing identity while the folder picker is open prevents any repository grant", () => fixture(async (root) => {
  const identity = { workspaceId: "workspace", actorId: "actor", sessionId: randomUUID() };
  let changed = false;
  const handler = createNativeRepositoryHandler({ interactive() {}, signal: new AbortController().signal,
    activeSession: () => identity.sessionId,
    choose: async () => { changed = true; return { canceled: false, filePaths: [root] }; },
    binding: async () => ({ ...identity, actorId: changed ? "different" : identity.actorId }) });
  await expect(handler.invoke("1", { action: "select", ...identity, scope: ["src"] }))
    .rejects.toThrow("repository_identity_changed");
  handler.close();
}));

test("native repository shutdown prevents future selection and inactive sessions never open picker", () => fixture(async (root) => {
  const identity = { workspaceId: "workspace", actorId: "actor", sessionId: randomUUID() };
  const controller = new AbortController();
  let active: string | null = null, selected = 0;
  const handler = createNativeRepositoryHandler({ interactive() {}, signal: controller.signal,
    activeSession: () => active,
    choose: async () => { selected++; return { canceled: false, filePaths: [root] }; },
    binding: async () => identity });
  await expect(handler.invoke("1", { action: "select", ...identity, scope: ["src"] }))
    .rejects.toThrow("repository_session_changed");
  expect(selected).toBe(0);
  active = identity.sessionId; controller.abort();
  await expect(handler.invoke("1", { action: "select", ...identity, scope: ["src"] }))
    .rejects.toThrow("repository_cancelled");
  expect(selected).toBe(0);
}));

test("repository cancellation drains a pending picker even during renderer shutdown", () => fixture(async (root) => {
  const identity = { workspaceId: "workspace", actorId: "actor", sessionId: randomUUID() };
  let ready!: () => void, finish!: (value: { canceled: boolean; filePaths: string[] }) => void;
  let closing = false;
  const opened = new Promise<void>((resolve) => { ready = resolve; });
  const picker = new Promise<{ canceled: boolean; filePaths: string[] }>((resolve) => { finish = resolve; });
  const handler = createNativeRepositoryHandler({ interactive() { if (closing) throw Error("closing"); },
    signal: new AbortController().signal, activeSession: () => identity.sessionId,
    choose: () => { ready(); return picker; }, binding: async () => identity });
  const pending = handler.invoke("1", { action: "select", ...identity, scope: ["src"] });
  await opened; closing = true;
  expect(await handler.invoke("1", { action: "cancel", ...identity })).toEqual({ canceled: true });
  await expect(pending).rejects.toThrow("repository_cancelled");
  finish({ canceled: false, filePaths: [root] });
  handler.close();
}));
