import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { sqliteConnection } from "../storage/sqlite/connection.ts";
import { migrateSqlite } from "../storage/migrations.ts";
import { sqlitePersonal } from "../storage/sqlite/personal.ts";
import { prepareLegacyInstallation } from "./installation.ts";
import { writeLegacyLocal } from "./local.ts";
import { legacyReader } from "./reader.ts";
import { desktopWorkspace } from "./desktop-workspace.ts";
import { verifyDesktopStorage } from "./desktop-verify.ts";
import {
  physicalStorageDirectory,
  readDesktopPointer,
  createStorageRoot,
  publishDesktopPointer,
  type DesktopStoragePointer,
} from "./desktop-pointer.ts";
import type { SecretVault } from "../providers/domain.ts";
export type DesktopStorageOptions = {
  profile: string;
  seed: string;
  selectedWorkspace?: string;
  quiesced: boolean;
  vault?: SecretVault;
  signal: AbortSignal;
};
async function exists(filename: string) {
  try {
    await access(filename);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return false;
    throw error;
  }
}
export async function prepareDesktopStorage(options: DesktopStorageOptions) {
  if (!options.quiesced)
    throw Error("Desktop migration requires stopped legacy writes");
  options.signal.throwIfAborted();
  const profile = await physicalStorageDirectory(options.profile);
  const active = await readDesktopPointer(profile);
  const storage = await createStorageRoot(profile);
  if (active) {
    const directory = await physicalStorageDirectory(
      join(storage, active.directory),
    );
    await verifyDesktopStorage(directory);
    await migrateDatabase(directory, active.workspaceId);
    options.signal.throwIfAborted();
    return {
      directory,
      workspaceId: active.workspaceId,
      imported: Boolean(active.sourceHash),
    };
  }
  const identifier = crypto.randomUUID(),
    directory = join(storage, identifier);
  const source = join(profile, "data");
  let workspaceId = options.seed,
    sourceHash: string | undefined;
  if (await exists(source)) {
    await physicalStorageDirectory(source);
    const names = await readdir(source);
    if (
      names.some(
        (name) =>
          name.endsWith(".sqlite") &&
          !["cadence.sqlite", "calendar.sqlite", "onboarding.sqlite"].includes(
            name,
          ),
      )
    )
      throw Error("Existing desktop database requires migration review");
    if (names.includes("cadence.sqlite")) {
      const reader = await legacyReader(join(source, "cadence.sqlite"));
      try {
        workspaceId = desktopWorkspace(
          reader.rows("owners").map((row) => String(row.id)),
          options.seed,
          options.selectedWorkspace,
        );
      } finally {
        reader.close();
      }
      const prepared = await prepareLegacyInstallation(source, directory, {
        quiesced: true,
        ...(options.vault ? { vault: options.vault } : {}),
      });
      options.signal.throwIfAborted();
      if (prepared.manifest.unhandled.length)
        throw Error("Unknown legacy data prevents desktop activation");
      const manifest = await writeLegacyLocal(prepared);
      await verifyDesktopStorage(directory, manifest);
      sourceHash = manifest.sourceHash;
    } else if (names.length)
      throw Error("Incomplete desktop installation requires migration review");
  }
  options.signal.throwIfAborted();
  await migrateDatabase(directory, workspaceId);
  await verifyDesktopStorage(directory);
  options.signal.throwIfAborted();
  const pointer: DesktopStoragePointer = {
    format: "cadence-desktop-storage/1",
    directory: identifier,
    workspaceId,
    ...(sourceHash ? { sourceHash } : {}),
  };
  await publishDesktopPointer(profile, pointer);
  return { directory, workspaceId, imported: Boolean(sourceHash) };
}
async function migrateDatabase(directory: string, workspaceId: string) {
  const connection = sqliteConnection(join(directory, "cadence-next.sqlite"));
  try {
    await migrateSqlite(connection);
    sqlitePersonal(connection, workspaceId);
  } finally {
    connection.close();
  }
}
