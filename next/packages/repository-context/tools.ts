import type { RepositoryGrant } from "./grants.ts";

export type RepositoryRevision = { grantId: string; revision: number; snapshotSha256: string };

export function assertRepositoryRevision(grant: RepositoryGrant, expected: RepositoryRevision) {
  if (grant.id !== expected.grantId || grant.revision !== expected.revision
    || grant.snapshot.sha256 !== expected.snapshotSha256)
    throw Error("repository_revision_changed");
  if (grant.pending) throw Error("repository_refresh_pending");
}

export function repositoryPreview(grant: RepositoryGrant) {
  return { grantId: grant.id, revision: grant.revision, snapshotSha256: grant.snapshot.sha256,
    approved: grant.approved,
    createdAt: grant.snapshot.createdAt, scope: [...grant.snapshot.scope], bytes: grant.snapshot.bytes,
    skipped: { ...grant.snapshot.skipped },
    files: grant.snapshot.files.map(({ path, bytes, sha256, lines }) => ({ path, bytes, sha256, lines })),
    readOnly: true as const, automaticallySynchronized: false as const };
}

function requireApproved(grant: RepositoryGrant, expected: RepositoryRevision) {
  assertRepositoryRevision(grant, expected);
  if (!grant.approved) throw Error("repository_consent_required");
}

export function listRepositoryFiles(grant: RepositoryGrant, expected: RepositoryRevision) {
  requireApproved(grant, expected);
  return repositoryPreview(grant);
}

export function readRepositoryFile(grant: RepositoryGrant, expected: RepositoryRevision,
  input: { path: string; fromLine: number; toLine: number }) {
  requireApproved(grant, expected);
  const file = grant.snapshot.files.find((entry) => entry.path === input.path);
  if (!file) throw Error("repository_file_not_found");
  if (!Number.isSafeInteger(input.fromLine) || !Number.isSafeInteger(input.toLine)
    || input.fromLine < 1 || input.toLine < input.fromLine || input.toLine - input.fromLine >= 200
    || input.fromLine > file.lines) throw Error("repository_line_range_invalid");
  const toLine = Math.min(input.toLine, file.lines);
  return { grantId: grant.id, revision: grant.revision, snapshotSha256: grant.snapshot.sha256,
    path: file.path, sha256: file.sha256, fromLine: input.fromLine, toLine,
    text: file.text.split(/\r?\n/).slice(input.fromLine - 1, toLine).join("\n") };
}

export function searchRepositoryFiles(grant: RepositoryGrant, expected: RepositoryRevision,
  input: { query: string; path?: string }) {
  requireApproved(grant, expected);
  if (typeof input.query !== "string" || input.query.length < 2 || input.query.length > 128
    || /[\x00-\x1f]/.test(input.query)) throw Error("repository_query_invalid");
  const files = input.path === undefined ? grant.snapshot.files
    : grant.snapshot.files.filter((file) => file.path === input.path);
  if (input.path !== undefined && !files.length) throw Error("repository_file_not_found");
  const query = input.query.toLocaleLowerCase("en-US");
  const matches: { path: string; sha256: string; line: number; text: string; truncated: boolean }[] = [];
  let more = false;
  for (const file of files) for (const [index, line] of file.text.split(/\r?\n/).entries()) {
    if (!line.toLocaleLowerCase("en-US").includes(query)) continue;
    if (matches.length >= 20) { more = true; continue; }
    matches.push({ path: file.path, sha256: file.sha256, line: index + 1,
      text: line.slice(0, 500), truncated: line.length > 500 });
  }
  return { grantId: grant.id, revision: grant.revision, snapshotSha256: grant.snapshot.sha256,
    query: input.query, matches, more };
}
