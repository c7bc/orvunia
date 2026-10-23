import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function runtimeSourcePaths(root: string, signal: AbortSignal) {
  const paths: string[] = [];
  async function collect(directory: string): Promise<void> {
    signal.throwIfAborted();
    for (const entry of await readdir(join(root, directory), {
      withFileTypes: true,
    })) {
      const path = directory + "/" + entry.name;
      if (entry.isSymbolicLink())
        throw Error("Runtime source cannot contain symbolic links");
      if (entry.isDirectory()) await collect(path);
      else if (entry.isFile() && /\.(ts|sql)$/.test(entry.name))
        paths.push(path);
      else throw Error("Unexpected file in runtime source modules");
    }
  }
  for (const directory of ["apps", "packages", "db"]) await collect(directory);
  paths.push(
    "package.json",
    "bun.lock",
    "scripts/migrate.ts",
    "scripts/worker-health.ts",
  );
  return paths.sort((first, second) => first.localeCompare(second, "en"));
}
