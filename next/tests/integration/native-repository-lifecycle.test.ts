import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { nativeRepository } from "../../packages/desktop/repository-native.ts";
import type { NativeContext } from "../../packages/desktop/application-types.ts";
import type { PlatformInvocation } from "../../packages/desktop/platform-types.ts";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "orvunia-native-lifecycle-"));
  await mkdir(join(root, "src")); await writeFile(join(root, "src/app.ts"), "export const version = 1;");
  const origin = "https://orvunia.example", workspaceId = "workspace", actorId = "actor";
  let picks = 0;
  const context = { profile: join(root, "profile"), origin, deployment: "cloud", panel: null,
    active: null, abort: new AbortController(), electron: { dialog: {
      async showOpenDialog() { picks++; return { canceled: false, filePaths: [root] }; },
    } } } as unknown as NativeContext;
  const requests = ["panel", "overlay"].map((view, index) => {
    const frame = { url: `${origin}/desktop.html?view=${view}` };
    const sender = { id: index + 1, mainFrame: frame, isDestroyed: () => false, getURL: () => frame.url,
      session: { async fetch(url: string) {
        const path = new URL(url).pathname;
        if (path.startsWith("/api/repository-preparation/modes/"))
          return Response.json({ workspaceId, actorId, modeId: "technical" });
        if (path.startsWith("/api/repository-preparation/sessions/"))
          return Response.json({ workspaceId, actorId, modeId: "technical", sessionId: context.active?.id });
        return Response.json({ workspaceId, actorId, sessionId: context.active?.id });
      } } };
    return { sender, senderFrame: frame } as unknown as PlatformInvocation;
  });
  const repository = nativeRepository(context, { interactive() {}, contents: () => requests.map((value) => value.sender) });
  return { root, context, repository, panel: requests[0]!, overlay: requests[1]!, picks: () => picks,
    async close() { repository.close(); context.abort.abort(); await rm(root, { recursive: true, force: true }); } };
}

test("native composition reopens preparation across repeated session begin/end boundaries without reusing closed services", async () => {
  const value = await fixture();
  try {
    await value.repository.invoke(value.panel, { preparation: "select", modeId: "technical", scope: ["src"] });
    for (let cycle = 0; cycle < 3; cycle++) {
      const sessionId = crypto.randomUUID();
      value.context.active = { id: sessionId, mode: "technical" };
      value.repository.close();
      const identity = { workspaceId: "workspace", actorId: "actor", sessionId };
      const preview = await value.repository.invoke(value.overlay,
        { ...identity, action: "select-prepared", modeId: "technical" }) as {
          grantId: string; revision: number; snapshotSha256: string };
      const binding = { grantId: preview.grantId, revision: preview.revision, snapshotSha256: preview.snapshotSha256 };
      const read = { ...identity, ...binding, action: "read", path: "src/app.ts", fromLine: 1, toLine: 1 };
      await expect(value.repository.invoke(value.overlay, read)).rejects.toThrow("repository_consent_required");
      await value.repository.invoke(value.overlay, { ...identity, ...binding, action: "approve", consent: true });
      expect(await value.repository.invoke(value.overlay, read)).toMatchObject({ text: "export const version = 1;" });
      value.context.active = null; value.repository.close();
      expect(await value.repository.invoke(value.panel, { preparation: "status", modeId: "technical" }))
        .toMatchObject({ name: expect.any(String), preview: { approved: false } });
      await expect(value.repository.invoke(value.overlay, read)).rejects.toThrow("repository_session_changed");
    }
    expect(value.picks()).toBe(1);
    expect(await value.repository.invoke(value.panel, { preparation: "select", modeId: "technical", scope: ["src"] }))
      .toMatchObject({ preview: { approved: false } });
    expect(value.picks()).toBe(2);
  } finally { await value.close(); }
});

test("resetting native repository services does not allow preparation after application shutdown", async () => {
  const value = await fixture();
  try {
    await value.repository.invoke(value.panel, { preparation: "select", modeId: "technical", scope: ["src"] });
    value.repository.close(); value.context.abort.abort();
    await expect(value.repository.invoke(value.panel, { preparation: "status", modeId: "technical" })).rejects.toThrow();
    expect(value.picks()).toBe(1);
  } finally { await value.close(); }
});
