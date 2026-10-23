import { realpath, lstat, mkdir, rm, writeFile, rmdir } from "node:fs/promises";
import { readPrivateFile } from "../providers/private-file.ts";
import {
  resolve,
  dirname,
  basename,
  join,
  relative,
  isAbsolute,
  sep,
} from "node:path";
function inside(parent: string, child: string) {
  const value = relative(parent, child);
  return (
    !value ||
    (!isAbsolute(value) && value !== ".." && !value.startsWith(".." + sep))
  );
}
export async function runtimeDestination(source: string, destination: string) {
  const root = await realpath(resolve(source));
  const parent = await realpath(dirname(resolve(destination)));
  const target = join(parent, basename(resolve(destination)));
  if (inside(root, target) || inside(target, root))
    throw Error(
      "Runtime package must be outside its source and use a fresh destination",
    );
  await mkdir(target);
  const owner = crypto.randomUUID(),
    marker = join(target, ".package-owner");
  try {
    await writeFile(marker, owner, { flag: "wx", mode: 0o600 });
  } catch (error) {
    await rmdir(target);
    throw error;
  }
  return {
    source: root,
    target,
    async discard() {
      const actual = await realpath(target).catch((error: unknown) => {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        )
          return null;
        throw error;
      });
      if (!actual) return;
      if (actual !== target || !(await lstat(target)).isDirectory())
        throw Error("Refusing to remove a replaced runtime destination");
      if ((await readPrivateFile(marker, 128)).toString("utf8") !== owner)
        throw Error("Runtime destination is no longer owned by this build");
      await rm(target, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    },
  };
}
