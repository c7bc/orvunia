import { createHash, randomUUID } from "node:crypto";
import { createRepositoryContext } from "../repository-context/service.ts";
import { repositoryFilesystem } from "../repository-context/filesystem.ts";
import { repositoryBinding, repositoryCommand } from "./repository-contracts.ts";
import type { RepositoryOwner } from "../repository-context/grants.ts";
import { repositoryOwnerKey } from "../repository-context/grants.ts";
import { repositorySelections } from "./repository-selection.ts";
import { repositoryAuthorizations, type PreparedSelection } from "./repository-authorizations.ts";

export function createNativeRepositoryHandler(ports: {
  interactive(): void;
  signal: AbortSignal;
  activeSession(): string | null;
  choose(): Promise<{ canceled: boolean; filePaths: string[] }>;
  binding(sessionId: string, signal: AbortSignal): Promise<unknown>;
  prepared?(owner: RepositoryOwner, modeId: string): Promise<PreparedSelection>;
}) {
  const service = createRepositoryContext({ clock: () => new Date(), identifier: randomUUID,
    hash: (bytes) => createHash("sha256").update(bytes).digest("hex"), open: repositoryFilesystem });
  const selections = repositorySelections();
  const authorizations = repositoryAuthorizations(ports.prepared);
  const close = () => {
    ports.signal.removeEventListener("abort", close);
    service.close();
    selections.close();
    authorizations.clear();
  };
  ports.signal.addEventListener("abort", close, { once: true });
  if (ports.signal.aborted) close();
  async function validate(owner: RepositoryOwner) {
    ports.signal.throwIfAborted();
    if (ports.activeSession() !== owner.sessionId) throw Error("repository_session_changed");
    const actual = repositoryBinding.parse(await ports.binding(owner.sessionId, ports.signal));
    if (actual.workspaceId !== owner.workspaceId || actual.actorId !== owner.actorId
      || actual.sessionId !== owner.sessionId) throw Error("repository_identity_changed");
  }
  return {
    close,
    async invoke(windowId: string, value: unknown) {
      const parsed = repositoryCommand.safeParse(value);
      if (!parsed.success) throw Error("repository_command_invalid");
      const command = parsed.data;
      const owner = { workspaceId: command.workspaceId, actorId: command.actorId,
        sessionId: command.sessionId, windowId };
      if (command.action === "cancel") {
        selections.cancel(repositoryOwnerKey(owner));
        service.revokeOwner(owner);
        authorizations.removeOwner(owner);
        return { canceled: true };
      }
      ports.interactive();
      try {
        await validate(owner);
        if (command.action === "select" || command.action === "select-prepared") {
          const prepared = command.action === "select-prepared" ? await ports.prepared?.(owner, command.modeId) : null;
          if (command.action === "select-prepared" && !prepared) throw Error("repository_preparation_missing");
          const selected = prepared ? { canceled: false, filePaths: [prepared.root] }
            : await selections.choose(repositoryOwnerKey(owner), ports.choose, ports.signal);
          ports.interactive();
          await validate(owner);
          if (selected.canceled) return { canceled: true };
          if (selected.filePaths.length !== 1) throw Error("repository_selection_invalid");
          const result = await service.select(owner, selected.filePaths[0]!,
            prepared?.scope ?? (command.action === "select" ? command.scope : []), ports.signal);
          await validate(owner);
          authorizations.register(owner, result.grantId, command.action === "select-prepared" ? command.modeId : undefined,
            prepared ?? null, command.action === "select" && command.noticeVersion === 1);
          if (await authorizations.valid(owner, result.grantId)) service.approve(owner, result, true);
          await validate(owner);
          authorizations.assertCurrent(owner, result.grantId);
          return service.preview(owner, result);
        }
        if (command.action === "revoke") {
          service.revoke(owner, command.grantId);
          authorizations.remove(command.grantId);
          return { revoked: true };
        }
        let authorized = false;
        try { authorized = await authorizations.valid(owner, command.grantId); }
        catch (error) { service.revokeOwner(owner); authorizations.removeOwner(owner); throw error; }
        await validate(owner);
        authorizations.assertCurrent(owner, command.grantId);
        if (command.action === "refresh") {
          const result = await service.refresh(owner, command, ports.signal);
          await validate(owner);
          if (authorized && await authorizations.valid(owner, command.grantId)) service.approve(owner, result, true);
          await validate(owner);
          authorizations.assertCurrent(owner, command.grantId);
          return { ...result, approved: service.preview(owner, result).approved };
        }
        if (command.action === "preview") return service.preview(owner, command);
        if (command.action === "approve") return service.approve(owner, command, command.consent);
        if (command.action === "list") return service.list(owner, command);
        if (command.action === "read") return service.read(owner, command, command);
        return service.search(owner, command, {
          query: command.query, ...(command.path ? { path: command.path } : {}),
        });
      } catch (error) {
        if (error instanceof Error && ["repository_identity_changed", "repository_session_changed"].includes(error.message)) {
          service.revokeOwner(owner); authorizations.removeOwner(owner);
        }
        if (ports.signal.aborted) throw Error("repository_cancelled");
        const code = error instanceof Error && /^repository_[a-z_]+$/.test(error.message)
          ? error.message : "repository_unavailable";
        if ((command.action === "read" || command.action === "search")
          && ["repository_file_not_found", "repository_line_range_invalid"].includes(code)) {
          return { grantId: command.grantId, revision: command.revision,
            snapshotSha256: command.snapshotSha256, error: { code, tool: `repository_${command.action}` } };
        }
        throw Error(code);
      }
    },
  };
}
