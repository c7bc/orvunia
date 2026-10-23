import { repositoryLimits } from "./domain.ts";
import type { RepositoryReader, RepositorySnapshot, RepositorySkip } from "./domain.ts";
import { decodeRepositoryText, repositoryContainsSensitiveText } from "./sensitive.ts";

export async function createRepositorySnapshot(
  reader: RepositoryReader,
  ports: { hash(bytes: Uint8Array): string; clock(): Date },
  signal: AbortSignal,
): Promise<RepositorySnapshot> {
  signal.throwIfAborted();
  const skipped: Record<RepositorySkip, number> = {
    excluded: 0, unsupported: 0, linked: 0, large: 0,
    binary: 0, sensitive: 0, limit: 0,
  };
  const snapshot: RepositorySnapshot = {
    version: 1, createdAt: ports.clock().toISOString(), sha256: "",
    scope: [...reader.scope], files: [], bytes: 0, skipped,
  };
  let entries = 0;
  for await (const entry of reader.entries(signal)) {
    signal.throwIfAborted();
    if (++entries > repositoryLimits.entries) throw Error("repository_entries_limit");
    if (entry.skipped) { skipped[entry.skipped]++; continue; }
    if (entry.bytes > repositoryLimits.fileBytes) { skipped.large++; continue; }
    if (snapshot.files.length >= repositoryLimits.files
      || snapshot.bytes + entry.bytes > repositoryLimits.totalBytes) {
      skipped.limit++; continue;
    }
    const bytes = await reader.read(entry.path, signal);
    signal.throwIfAborted();
    if (bytes.byteLength > repositoryLimits.fileBytes
      || snapshot.bytes + bytes.byteLength > repositoryLimits.totalBytes)
      throw Error("repository_file_changed");
    const text = decodeRepositoryText(bytes);
    if (text === null) { skipped.binary++; continue; }
    if (repositoryContainsSensitiveText(text)) { skipped.sensitive++; continue; }
    snapshot.files.push({ path: entry.path, text, bytes: bytes.byteLength,
      sha256: ports.hash(bytes), lines: text.split(/\r?\n/).length });
    snapshot.bytes += bytes.byteLength;
  }
  signal.throwIfAborted();
  snapshot.sha256 = ports.hash(new TextEncoder().encode(JSON.stringify({
    scope: snapshot.scope,
    files: snapshot.files.map(({ path, sha256 }) => ({ path, sha256 })),
  })));
  return snapshot;
}
