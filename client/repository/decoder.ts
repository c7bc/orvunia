import { record, text, array } from "../legacy-web/validation.js";
import type { RepositoryIdentity, RepositoryPreview } from "./contracts.js";

function bounded(value: unknown, maximum = 240) {
  const result = text(value);
  if (!result || result.length > maximum || /[\x00-\x1f]/.test(result))
    throw Error("repository_response_invalid");
  return result;
}
function integer(value: unknown, minimum = 0) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum)
    throw Error("repository_response_invalid");
  return value;
}
function hash(value: unknown) {
  const result = text(value);
  if (!/^[a-f0-9]{64}$/.test(result)) throw Error("repository_response_invalid");
  return result;
}
export function decodeRepositoryIdentity(value: unknown): RepositoryIdentity {
  const item = record(value);
  return { workspaceId: bounded(item.workspaceId, 128), actorId: bounded(item.actorId, 128),
    sessionId: bounded(item.sessionId, 128) };
}
export function decodeRepositoryPreview(value: unknown): RepositoryPreview {
  const item = record(value);
  if (typeof item.approved !== "boolean") throw Error("repository_response_invalid");
  const skipped = record(item.skipped);
  const files = array(item.files, (value) => {
    const file = record(value);
    const path = bounded(file.path);
    if (path.startsWith("/") || path.includes("\\") || path.split("/").includes("..") || path.includes(":"))
      throw Error("repository_response_invalid");
    return { path, bytes: integer(file.bytes), sha256: hash(file.sha256), lines: integer(file.lines, 1) };
  });
  if (files.length > 20) throw Error("repository_response_invalid");
  const markdown = item.markdown === undefined ? undefined : text(item.markdown);
  if (markdown && markdown.length > 29_000) throw Error("repository_response_invalid");
  return { grantId: bounded(item.grantId, 128), revision: integer(item.revision, 1),
    snapshotSha256: hash(item.snapshotSha256), approved: item.approved,
    createdAt: bounded(item.createdAt, 40),
    scope: array(item.scope, (value) => bounded(value)), bytes: integer(item.bytes), files,
    skipped: Object.fromEntries(Object.entries(skipped).map(([key, value]) => [key, integer(value)])),
    ...(markdown === undefined ? {} : { markdown }) };
}
