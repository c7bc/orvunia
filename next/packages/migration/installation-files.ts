import { lstat, mkdir, open, readdir, realpath } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { createHash } from "node:crypto";
import { readPrivateFile } from "../providers/private-file.ts";
export const legacyPrivateFiles = [
  "providers.json",
  "external-env.json",
  "settings.json",
  "desktop.json",
  "desktop-auth-device.json",
  ".calendar-key",
] as const;
export async function installationFiles(
  source: string,
  destination: string,
  deployment: "local" | "cloud" = "local",
) {
  const root = resolve(source),
    target = resolve(destination),
    stat = await lstat(root);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (await realpath(root)) !== root ||
    root === target ||
    target.startsWith(root + sep)
  )
    throw Error(
      "Legacy installation requires distinct real source and staging directories",
    );
  const names = new Set(await readdir(root));
  if (deployment === "local" && names.has("identity.sqlite"))
    throw Error("Cloud identity requires the PostgreSQL migration path");
  if (deployment === "cloud" && !names.has("identity.sqlite"))
    throw Error("Cloud migration requires its legacy identity database");
  for (const name of names)
    if (
      name.endsWith(".sqlite") &&
      ![
        "cadence.sqlite",
        "onboarding.sqlite",
        "calendar.sqlite",
        ...(deployment === "cloud" ? ["identity.sqlite"] : []),
      ].includes(name)
    )
      throw Error("Unknown legacy database requires migration review");
  return { root, names, path: (name: string) => join(root, name) };
}
export async function archiveInstallationFiles(
  source: { names: Set<string>; path(name: string): string },
  root: string,
) {
  const directory = join(root, "legacy-files");
  await mkdir(directory, { mode: 0o700 });
  const archives: { name: string; sha256: string }[] = [];
  for (const name of legacyPrivateFiles) {
    if (!source.names.has(name)) continue;
    const data = await readPrivateFile(
        source.path(name),
        name === ".calendar-key" ? 32 : 4 * 1024 * 1024,
      ),
      handle = await open(join(directory, name), "wx", 0o600);
    try {
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }
    archives.push({
      name,
      sha256: createHash("sha256").update(data).digest("hex"),
    });
  }
  return { directory, archives };
}
