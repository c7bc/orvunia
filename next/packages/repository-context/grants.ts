import type { RepositoryReader, RepositorySnapshot } from "./domain.ts";

export type RepositoryOwner = { workspaceId: string; actorId: string; sessionId: string; windowId: string };
export type RepositoryGrant = {
  id: string;
  owner: RepositoryOwner;
  reader: RepositoryReader;
  snapshot: RepositorySnapshot;
  revision: number;
  approved: boolean;
  pending: AbortController | null;
};

export function repositoryOwnerKey(owner: RepositoryOwner) {
  const values = [owner.workspaceId, owner.actorId, owner.sessionId, owner.windowId];
  if (values.some((value) => typeof value !== "string" || !value || value.length > 128))
    throw Error("repository_owner_invalid");
  return JSON.stringify(values);
}

export function repositoryGrants(ports: { identifier(): string }) {
  const grants = new Map<string, RepositoryGrant>();
  const pending = new Map<string, AbortController>();
  let closed = false;
  function revoke(id: string) {
    const grant = grants.get(id);
    grant?.pending?.abort();
    grants.delete(id);
  }
  function removeOwner(owner: RepositoryOwner) {
    const key = repositoryOwnerKey(owner);
    pending.get(key)?.abort();
    pending.delete(key);
    for (const [id, grant] of grants)
      if (repositoryOwnerKey(grant.owner) === key) revoke(id);
  }
  return {
    begin(owner: RepositoryOwner) {
      if (closed) throw Error("repository_closed");
      const key = repositoryOwnerKey(owner);
      removeOwner(owner);
      if (grants.size + pending.size >= 8) throw Error("repository_grant_limit");
      const controller = new AbortController();
      pending.set(key, controller);
      return controller;
    },
    finish(owner: RepositoryOwner, controller: AbortController, reader: RepositoryReader,
      snapshot: RepositorySnapshot) {
      const key = repositoryOwnerKey(owner);
      controller.signal.throwIfAborted();
      if (pending.get(key) !== controller) throw Error("repository_selection_changed");
      pending.delete(key);
      const grant: RepositoryGrant = { id: ports.identifier(), owner: { ...owner }, reader,
        snapshot, revision: 1, approved: false,
        pending: null };
      grants.set(grant.id, grant);
      return grant;
    },
    failed(owner: RepositoryOwner, controller: AbortController) {
      const key = repositoryOwnerKey(owner);
      if (pending.get(key) === controller) pending.delete(key);
    },
    require(owner: RepositoryOwner, id: string) {
      const grant = grants.get(id);
      if (!grant || repositoryOwnerKey(grant.owner) !== repositoryOwnerKey(owner))
        throw Error("repository_grant_not_found");
      return grant;
    },
    removeOwner,
    revoke(owner: RepositoryOwner, id: string) {
      const grant = grants.get(id);
      if (!grant || repositoryOwnerKey(grant.owner) !== repositoryOwnerKey(owner))
        throw Error("repository_grant_not_found");
      revoke(id);
    },
    close() {
      closed = true;
      for (const controller of pending.values()) controller.abort();
      pending.clear();
      for (const id of grants.keys()) revoke(id);
    },
  };
}
