import type { RepositoryOwner } from "../repository-context/grants.ts";
import { repositoryOwnerKey } from "../repository-context/grants.ts";

export type PreparedSelection = { root: string; scope: string[]; authorizationId?: string; current?(): boolean };

export function repositoryAuthorizations(
  prepared: ((owner: RepositoryOwner, modeId: string) => Promise<PreparedSelection>) | undefined,
) {
  const grants = new Map<string, { owner: string; prepared: { modeId: string; selection: PreparedSelection } | null }>();
  function removeOwner(owner: RepositoryOwner) {
    for (const [id, grant] of grants) if (grant.owner === repositoryOwnerKey(owner)) grants.delete(id);
  }
  function assertCurrent(owner: RepositoryOwner, grantId: string) {
    const grant = grants.get(grantId);
    if (!grant) return;
    if (grant.owner !== repositoryOwnerKey(owner)) throw Error("repository_grant_not_found");
    if (grant.prepared?.selection.current?.() === false) throw Error("repository_consent_required");
  }
  return {
    register(owner: RepositoryOwner, grantId: string, modeId: string | undefined, selection: PreparedSelection | null, noticed: boolean) {
      removeOwner(owner);
      const binding = { owner: repositoryOwnerKey(owner) };
      if (modeId && selection?.authorizationId) grants.set(grantId, { ...binding, prepared: { modeId, selection } });
      else if (noticed) grants.set(grantId, { ...binding, prepared: null });
    },
    async valid(owner: RepositoryOwner, grantId: string) {
      assertCurrent(owner, grantId);
      if (!grants.has(grantId)) return false;
      const binding = grants.get(grantId)!;
      if (binding.owner !== repositoryOwnerKey(owner)) throw Error("repository_grant_not_found");
      const grant = binding.prepared;
      if (!grant) return true;
      const current = await prepared?.(owner, grant.modeId);
      if (!current || current.authorizationId !== grant.selection.authorizationId
        || current.root !== grant.selection.root || JSON.stringify(current.scope) !== JSON.stringify(grant.selection.scope))
        throw Error("repository_consent_required");
      return true;
    },
    remove(grantId: string) { grants.delete(grantId); },
    assertCurrent,
    removeOwner,
    clear() { grants.clear(); },
  };
}
