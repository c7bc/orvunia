import { constants } from "node:fs";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { repositoryLimits } from "./domain.ts";
import type { RepositoryEntry, RepositoryReader } from "./domain.ts";
import { insideRepositoryScope, normalizeRepositoryScope,
  repositoryDirectoryNeeded, repositoryPathPolicy } from "./policy.ts";

export async function repositoryFilesystem(
  selectedRoot: string,
  requestedScope: readonly string[],
): Promise<RepositoryReader> {
  if (!isAbsolute(selectedRoot) || !requestedScope.length || requestedScope.length > 20)
    throw Error("repository_scope_invalid");
  const scope = [...new Set(requestedScope.map(normalizeRepositoryScope))].sort();
  if (scope.some((path) => repositoryPathPolicy(path, true)))
    throw Error("repository_scope_invalid");
  const initial = await lstat(selectedRoot);
  if (!initial.isDirectory() || initial.isSymbolicLink()) throw Error("repository_root_invalid");
  const root = await realpath(selectedRoot);
  const rootInfo = await lstat(root);
  const inside = (path: string) => {
    const value = relative(root, path);
    return value !== ".." && !value.startsWith(".." + sep) && !isAbsolute(value);
  };
  async function assertRoot() {
    const current = await lstat(root);
    if (!current.isDirectory() || current.isSymbolicLink()
      || current.ino !== rootInfo.ino || current.dev !== rootInfo.dev
      || await realpath(selectedRoot) !== root) throw Error("repository_root_changed");
  }
  async function assertPath(path: string, directory: boolean) {
    await assertRoot();
    if (!inside(path) || await realpath(path) !== path) throw Error("repository_path_changed");
    const info = await lstat(path);
    if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile()))
      throw Error("repository_path_changed");
    return info;
  }
  async function* walk(directory: string, depth: number, signal: AbortSignal,
    budget: { entries: number }): AsyncGenerator<RepositoryEntry> {
    signal.throwIfAborted();
    if (depth > repositoryLimits.depth) throw Error("repository_depth_limit");
    await assertPath(directory, true);
    const handle = await opendir(directory);
    const children: { name: string; directory: boolean; link: boolean }[] = [];
    for await (const entry of handle) {
      signal.throwIfAborted();
      if (++budget.entries > repositoryLimits.entries) throw Error("repository_entries_limit");
      children.push({ name: entry.name, directory: entry.isDirectory(), link: entry.isSymbolicLink() });
    }
    children.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    await assertPath(directory, true);
    for (const child of children) {
      signal.throwIfAborted();
      const filename = join(directory, child.name);
      const path = relative(root, filename).split(sep).join("/");
      if (child.link) { yield { path, bytes: 0, skipped: "linked" }; continue; }
      const policy = repositoryPathPolicy(path, child.directory);
      if (policy) { yield { path, bytes: 0, skipped: policy }; continue; }
      if (child.directory) {
        if (repositoryDirectoryNeeded(path, scope)) yield* walk(filename, depth + 1, signal, budget);
      } else if (insideRepositoryScope(path, scope)) {
        const info = await assertPath(filename, false);
        yield { path, bytes: info.size, ...(info.nlink > 1 ? { skipped: "linked" as const } : {}) };
      }
    }
  }
  return {
    scope,
    entries: (signal) => walk(root, 0, signal, { entries: 0 }),
    async read(path, signal) {
      signal.throwIfAborted();
      if (normalizeRepositoryScope(path) !== path || !insideRepositoryScope(path, scope)
        || repositoryPathPolicy(path, false)) throw Error("repository_scope_invalid");
      const filename = resolve(root, path);
      const before = await assertPath(filename, false);
      if (before.nlink > 1 || before.size > repositoryLimits.fileBytes)
        throw Error("repository_file_changed");
      const file = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const opened = await file.stat();
        if (!opened.isFile() || opened.nlink > 1 || opened.ino !== before.ino
          || opened.dev !== before.dev || opened.size !== before.size)
          throw Error("repository_file_changed");
        const buffer = Buffer.alloc(repositoryLimits.fileBytes + 1);
        let length = 0;
        while (length < buffer.length) {
          signal.throwIfAborted();
          const result = await file.read(buffer, length, buffer.length - length, null);
          if (!result.bytesRead) break;
          length += result.bytesRead;
        }
        const after = await file.stat();
        const current = await assertPath(filename, false);
        signal.throwIfAborted();
        if (length !== before.size || length > repositoryLimits.fileBytes
          || current.ino !== opened.ino || current.dev !== opened.dev
          || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs
          || after.ctimeMs !== opened.ctimeMs) throw Error("repository_file_changed");
        return new Uint8Array(buffer.subarray(0, length));
      } finally {
        await file.close();
      }
    },
  };
}
