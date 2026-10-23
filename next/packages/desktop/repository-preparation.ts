import { z } from "zod";
import { basename } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRepositoryContext } from "../repository-context/service.ts";
import { repositoryFilesystem } from "../repository-context/filesystem.ts";
import type { RepositoryOwner } from "../repository-context/grants.ts";
import { repositorySelections } from "./repository-selection.ts";
import type { RepositoryLocation, RepositoryLocations } from "./repository-locations.ts";

const identitySchema = z.object({ workspaceId: z.string().min(1).max(128), actorId: z.string().min(1).max(128),
  modeId: z.string().min(1).max(128) }).strict();
const commandSchema = z.discriminatedUnion("preparation", [
  z.object({ preparation: z.literal("select"), modeId: z.string().min(1).max(128),
    scope: z.array(z.string().min(1).max(240)).min(1).max(20), noticeVersion: z.literal(1).optional() }).strict(),
  z.object({ preparation: z.enum(["status", "remove", "cancel"]), modeId: z.string().min(1).max(128) }).strict(),
]);
type Identity = z.infer<typeof identitySchema>;
type Preview = ReturnType<ReturnType<typeof createRepositoryContext>["preview"]>;
type Entry = RepositoryLocation & { identity: Identity; owner: RepositoryOwner; preview: Preview; name: string };
const key = (identity: Identity) => JSON.stringify([identity.workspaceId, identity.actorId, identity.modeId]);

export function createNativeRepositoryPreparation(ports: {
  interactive(): void; signal: AbortSignal;
  identity(modeId: string, windowId: string): Promise<unknown>;
  session(sessionId: string, windowId: string): Promise<unknown>;
  activeSession(): string | null;
  choose(windowId: string): Promise<{ canceled: boolean; filePaths: string[] }>;
  locations?: RepositoryLocations;
}) {
  const entries = new Map<string, Entry>();
  const pending = new Map<string, { controller: AbortController; windowId: string; modeId: string }>();
  const selections = repositorySelections();
  const restoring = new Map<string, Promise<Entry | undefined>>();
  const service = createRepositoryContext({ clock: () => new Date(), identifier: randomUUID,
    hash: bytes => createHash("sha256").update(bytes).digest("hex"), open: repositoryFilesystem });
  const close = () => {
    for (const operation of pending.values()) operation.controller.abort();
    pending.clear(); selections.close(); service.close(); entries.clear();
  };
  ports.signal.addEventListener("abort", close, { once: true });
  const view = (entry: Entry) => ({ modeId: entry.identity.modeId, name: entry.name, preview: entry.preview,
    authorized: entry.authorization?.version === 1 });
  async function identity(modeId: string, windowId: string) {
    ports.signal.throwIfAborted();
    const current = identitySchema.parse(await ports.identity(modeId, windowId));
    if (current.modeId !== modeId) throw Error("repository_identity_changed");
    return current;
  }
  async function restore(current: Identity, windowId: string): Promise<Entry | undefined> {
    const id = key(current), old = entries.get(id);
    if (old) return old;
    const existing = restoring.get(id); if (existing) return existing;
    const location = ports.locations?.get(id);
    if (!location) return undefined;
    if (pending.has(id)) throw Error("repository_busy");
    if (entries.size >= 8) throw Error("repository_grant_limit");
    const controller = new AbortController();
    pending.set(id, { controller, windowId, modeId: current.modeId });
    const signal = AbortSignal.any([controller.signal, ports.signal]);
    const owner = { ...current, sessionId: `mode:${createHash("sha256").update(current.modeId).digest("hex").slice(0, 32)}`, windowId };
    const task = (async () => {
      let grantId: string | undefined;
      try {
        const selected = await service.select(owner, location.root, location.scope, signal);
        grantId = selected.grantId;
        if (key(await identity(current.modeId, windowId)) !== id) throw Error("repository_identity_changed");
        signal.throwIfAborted();
        if (pending.get(id)?.controller !== controller) throw Error("repository_cancelled");
        const entry: Entry = { ...location, identity: current, owner,
          preview: service.preview(owner, selected), name: basename(location.root) };
        entries.set(id, entry); return entry;
      } catch (error) {
        if (grantId) { try { service.revoke(owner, grantId); } catch {} }
        throw error;
      }
      finally {
        if (pending.get(id)?.controller === controller) pending.delete(id);
        restoring.delete(id);
      }
    })();
    restoring.set(id, task); return task;
  }
  return {
    close() { ports.signal.removeEventListener("abort", close); close(); },
    async invoke(windowId: string, input: unknown) {
      const command = commandSchema.parse(input);
      if (command.preparation === "cancel") {
        for (const [id, operation] of pending) {
          if (operation.windowId === windowId && operation.modeId === command.modeId) {
            operation.controller.abort(); pending.delete(id);
          }
        }
        return { canceled: true };
      }
      ports.interactive();
      const current = await identity(command.modeId, windowId);
      const id = key(current), old = entries.get(id);
      if (command.preparation === "status") {
        const prepared = old ?? await restore(current, windowId);
        return prepared ? view(prepared) : null;
      }
      if (command.preparation === "remove") {
        ports.locations?.remove(id);
        pending.get(id)?.controller.abort(); pending.delete(id);
        selections.cancel(id); if (old) service.revokeOwner(old.owner); entries.delete(id);
        return { removed: true };
      }
      if (command.preparation !== "select") throw Error("repository_command_invalid");
      if (!old && entries.size >= 8) throw Error("repository_grant_limit");
      pending.get(id)?.controller.abort();
      const controller = new AbortController();
      pending.set(id, { controller, windowId, modeId: command.modeId });
      const signal = AbortSignal.any([controller.signal, ports.signal]);
      try {
      const picked = await selections.choose(id, () => ports.choose(windowId), signal);
      signal.throwIfAborted();
      const actual = await identity(command.modeId, windowId);
      if (key(actual) !== id) throw Error("repository_identity_changed");
      if (picked.canceled) return { canceled: true };
      if (picked.filePaths.length !== 1) throw Error("repository_selection_invalid");
      const owner = { ...current, sessionId: `mode:${createHash("sha256").update(current.modeId).digest("hex").slice(0, 32)}`, windowId };
      const selected = await service.select(owner, picked.filePaths[0]!, command.scope, signal);
      signal.throwIfAborted();
      if (key(await identity(command.modeId, windowId)) !== id) {
        service.revoke(owner, selected.grantId); throw Error("repository_identity_changed");
      }
      if (signal.aborted || pending.get(id)?.controller !== controller) {
        service.revoke(owner, selected.grantId); throw Error("repository_cancelled");
      }
      if (old && old.owner.windowId !== windowId) service.revokeOwner(old.owner);
      const entry: Entry = { root: picked.filePaths[0]!, scope: [...command.scope], identity: current,
        ...(command.noticeVersion === 1 ? { authorization: { version: 1 as const, id: randomUUID() } } : {}),
        owner, preview: service.preview(owner, selected), name: basename(picked.filePaths[0]!) };
      ports.locations?.set(id, { root: entry.root, scope: entry.scope,
        ...(entry.authorization ? { authorization: entry.authorization } : {}) });
      entries.set(id, entry);
      return view(entry);
      } finally { if (pending.get(id)?.controller === controller) pending.delete(id); }
    },
    async selection(owner: RepositoryOwner, modeId: string) {
      if (ports.activeSession() !== owner.sessionId) throw Error("repository_session_changed");
      const session = identitySchema.extend({ sessionId: z.uuid() }).parse(await ports.session(owner.sessionId, owner.windowId));
      if (session.sessionId !== owner.sessionId || session.workspaceId !== owner.workspaceId
        || session.actorId !== owner.actorId || session.modeId !== modeId) throw Error("repository_identity_changed");
      const current = await identity(modeId, owner.windowId);
      if (key(current) !== key(session)) throw Error("repository_identity_changed");
      const entry = entries.get(key(current)) ?? await restore(current, owner.windowId);
      if (!entry) throw Error("repository_preparation_missing");
      return { root: entry.root, scope: [...entry.scope],
        current: () => !ports.signal.aborted && ports.activeSession() === owner.sessionId && entries.get(key(current)) === entry,
        ...(entry.authorization ? { authorizationId: entry.authorization.id } : {}) };
    },
  };
}
