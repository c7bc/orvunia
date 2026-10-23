import { test, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nativeRepositoryLocations } from "../../packages/desktop/repository-locations.ts";
import { createNativeRepositoryPreparation } from "../../packages/desktop/repository-preparation.ts";
import { createNativeRepositoryHandler } from "../../packages/desktop/repository-handlers.ts";

async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "orvunia-repository-recovery-"));
  try { await mkdir(join(root, "src")); await writeFile(join(root, "src/app.ts"), "export const version = 1;"); await run(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}
const identity = { workspaceId: "workspace", actorId: "actor", modeId: "technical" };
const command = { preparation: "select", modeId: "technical", scope: ["src"] };
function setup(root: string, identityPort = async () => identity) {
  const sessionId = crypto.randomUUID();
  let picks = 0;
  const locations = nativeRepositoryLocations(join(root, "locations.json"), () => "https://owned.example");
  const preparation = createNativeRepositoryPreparation({ interactive() {}, signal: new AbortController().signal,
    identity: identityPort, session: async () => ({ ...identity, sessionId }), activeSession: () => sessionId,
    choose: async () => { picks++; return { canceled: false, filePaths: [root] }; }, locations });
  return { preparation, sessionId, locations, picks: () => picks };
}

test("selected folder survives application restart but contents and session consent are always fresh", () => fixture(async root => {
  const first = setup(root); await first.preparation.invoke("panel", command); first.preparation.close();
  const stored = await readFile(join(root, "locations.json"), "utf8");
  expect(stored).not.toContain("approved"); expect(stored).not.toContain("grantId");
  expect(stored).not.toContain("export const");
  await writeFile(join(root, "src/app.ts"), "export const version = 2;");
  const second = setup(root);
  const restored = await second.preparation.invoke("overlay", { preparation: "status", modeId: "technical" });
  expect(restored).toMatchObject({ modeId: "technical", preview: { approved: false } });
  expect(JSON.stringify(restored)).toContain("version = 2");
  expect(JSON.stringify(restored)).not.toContain(root);
  const owner = { workspaceId: identity.workspaceId, actorId: identity.actorId, sessionId: second.sessionId };
  const handler = createNativeRepositoryHandler({ interactive() {}, signal: new AbortController().signal,
    activeSession: () => owner.sessionId, binding: async () => owner, prepared: second.preparation.selection,
    choose: async () => { throw Error("Picker must not reopen"); } });
  const selected = await handler.invoke("overlay", { action: "select-prepared", ...owner, modeId: "technical" }) as object;
  const chosen = selected as { grantId: string; revision: number; snapshotSha256: string };
  const binding = { ...owner, grantId: chosen.grantId, revision: chosen.revision, snapshotSha256: chosen.snapshotSha256 };
  await expect(handler.invoke("overlay", { ...binding, action: "read", path: "src/app.ts", fromLine: 1, toLine: 1 }))
    .rejects.toThrow("repository_consent_required");
  await handler.invoke("overlay", { ...binding, action: "approve", consent: true });
  expect(await handler.invoke("overlay", { ...binding, action: "read", path: "src/app.ts", fromLine: 1, toLine: 1 }))
    .toMatchObject({ text: "export const version = 2;" });
  expect(second.picks()).toBe(0); handler.close(); second.preparation.close();
}));

test("remembered location is isolated by origin and identity and removal survives restart", () => fixture(async root => {
  const first = setup(root); await first.preparation.invoke("panel", command); first.preparation.close();
  const other = setup(root, async () => ({ ...identity, actorId: "other" }));
  expect(await other.preparation.invoke("panel", { preparation: "status", modeId: "technical" })).toBeNull();
  other.preparation.close();
  const elsewhere = nativeRepositoryLocations(join(root, "locations.json"), () => "https://another.example");
  expect(elsewhere.get(JSON.stringify(Object.values(identity)))).toBeUndefined();
  const reopened = setup(root); await reopened.preparation.invoke("panel", { preparation: "remove", modeId: "technical" });
  reopened.preparation.close();
  const final = setup(root);
  expect(await final.preparation.invoke("panel", { preparation: "status", modeId: "technical" })).toBeNull();
  final.preparation.close();
}));

test("unavailable files fail explicitly instead of silently forgetting the selected repository", () => fixture(async root => {
  const first = setup(root); await first.preparation.invoke("panel", command); first.preparation.close();
  await rm(join(root, "src/app.ts"));
  const second = setup(root);
  await expect(second.preparation.invoke("overlay", { preparation: "status", modeId: "technical" })).rejects.toThrow();
  await writeFile(join(root, "src/app.ts"), "export const repaired = true;");
  expect(await second.preparation.invoke("overlay", { preparation: "status", modeId: "technical" }))
    .toMatchObject({ modeId: "technical" });
  second.preparation.close();
}));

test("removal during restored snapshot identity validation cannot resurrect the remembered folder", () => fixture(async root => {
  const first = setup(root); await first.preparation.invoke("panel", command); first.preparation.close();
  let checks = 0, finish!: () => void, entered!: () => void;
  const waiting = new Promise<void>(resolve => { entered = resolve; });
  const released = new Promise<void>(resolve => { finish = resolve; });
  const second = setup(root, async () => { if (++checks === 2) { entered(); await released; } return identity; });
  const restoring = second.preparation.invoke("panel", { preparation: "status", modeId: "technical" });
  await waiting;
  await second.preparation.invoke("panel", { preparation: "remove", modeId: "technical" }); finish();
  await expect(restoring).rejects.toThrow();
  expect(await second.preparation.invoke("panel", { preparation: "status", modeId: "technical" })).toBeNull();
  second.preparation.close();
}));

test("invalid local location metadata is preserved and reported without accepting renderer paths", () => fixture(async root => {
  await writeFile(join(root, "locations.json"), "corrupted metadata");
  const state = setup(root);
  await expect(state.preparation.invoke("panel", { preparation: "status", modeId: "technical" }))
    .rejects.toThrow("repository_locations_invalid");
  expect(await readFile(join(root, "locations.json"), "utf8")).toBe("corrupted metadata");
  state.preparation.close();
}));
