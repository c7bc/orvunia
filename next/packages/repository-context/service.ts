import type { RepositoryReader } from "./domain.ts";
import { repositoryGrants } from "./grants.ts";
import type { RepositoryOwner } from "./grants.ts";
import { createRepositorySnapshot } from "./snapshot.ts";
import { repositorySnapshotMarkdown } from "./markdown.ts";
import { assertRepositoryRevision, listRepositoryFiles, readRepositoryFile,
  repositoryPreview, searchRepositoryFiles } from "./tools.ts";
import type { RepositoryRevision } from "./tools.ts";

export function createRepositoryContext(ports: {
  clock(): Date;
  identifier(): string;
  hash(bytes: Uint8Array): string;
  open(selectedRoot: string, scope: readonly string[]): Promise<RepositoryReader>;
}) {
  const grants = repositoryGrants(ports);
  return {
    async select(owner: RepositoryOwner, selectedRoot: string, scope: readonly string[], signal: AbortSignal) {
      const controller = grants.begin(owner);
      const combined = AbortSignal.any([signal, controller.signal]);
      try {
        const reader = await ports.open(selectedRoot, scope);
        const snapshot = await createRepositorySnapshot(reader, ports, combined);
        if (!snapshot.files.length) throw Error("repository_snapshot_empty");
        repositorySnapshotMarkdown(snapshot);
        return repositoryPreview(grants.finish(owner, controller, reader, snapshot));
      } finally {
        grants.failed(owner, controller);
      }
    },
    preview(owner: RepositoryOwner, expected: RepositoryRevision) {
      const grant = grants.require(owner, expected.grantId);
      assertRepositoryRevision(grant, expected);
      return { ...repositoryPreview(grant), markdown: repositorySnapshotMarkdown(grant.snapshot) };
    },
    approve(owner: RepositoryOwner, expected: RepositoryRevision, consent: true) {
      if (consent !== true) throw Error("repository_consent_required");
      const grant = grants.require(owner, expected.grantId);
      assertRepositoryRevision(grant, expected);
      grant.approved = true;
      return repositoryPreview(grant);
    },
    list(owner: RepositoryOwner, expected: RepositoryRevision) {
      return listRepositoryFiles(grants.require(owner, expected.grantId), expected);
    },
    read(owner: RepositoryOwner, expected: RepositoryRevision,
      input: { path: string; fromLine: number; toLine: number }) {
      return readRepositoryFile(grants.require(owner, expected.grantId), expected, input);
    },
    search(owner: RepositoryOwner, expected: RepositoryRevision, input: { query: string; path?: string }) {
      return searchRepositoryFiles(grants.require(owner, expected.grantId), expected, input);
    },
    async refresh(owner: RepositoryOwner, expected: RepositoryRevision, signal: AbortSignal) {
      const grant = grants.require(owner, expected.grantId);
      assertRepositoryRevision(grant, expected);
      const controller = new AbortController();
      grant.pending = controller;
      grant.approved = false;
      try {
        const snapshot = await createRepositorySnapshot(grant.reader, ports,
          AbortSignal.any([signal, controller.signal]));
        repositorySnapshotMarkdown(snapshot);
        if (grants.require(owner, expected.grantId) !== grant) throw Error("repository_grant_not_found");
        const previous = new Map(grant.snapshot.files.map((file) => [file.path, file.sha256]));
        const current = new Map(snapshot.files.map((file) => [file.path, file.sha256]));
        const changes = { added: [...current.keys()].filter((path) => !previous.has(path)),
          removed: [...previous.keys()].filter((path) => !current.has(path)),
          modified: [...current.keys()].filter((path) => previous.has(path) && previous.get(path) !== current.get(path)) };
        grant.snapshot = snapshot;
        grant.revision++;
        return { ...repositoryPreview(grant), changes };
      } finally {
        grant.pending = null;
      }
    },
    revoke: (owner: RepositoryOwner, grantId: string) => grants.revoke(owner, grantId),
    revokeOwner: (owner: RepositoryOwner) => grants.removeOwner(owner),
    close: () => grants.close(),
  };
}
