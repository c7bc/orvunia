import { join } from "node:path";
import { z } from "zod";
import { prepareDesktopStorage } from "../../packages/migration/desktop.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { migrateSqlite } from "../../packages/storage/migrations.ts";
import type { LocalSettings } from "../../packages/config/local.ts";
import type { SecretVault } from "../../packages/providers/domain.ts";
export async function desktopStorage(
  settings: LocalSettings,
  environment: Record<string, string | undefined>,
  signal: AbortSignal,
  vault?: SecretVault,
) {
  if (environment.CADENCE_DESKTOP_PROFILE) {
    const selected = environment.CADENCE_LEGACY_WORKSPACE;
    const prepared = await prepareDesktopStorage({
      profile: environment.CADENCE_DESKTOP_PROFILE,
      seed: settings.CADENCE_LOCAL_WORKSPACE,
      quiesced: environment.CADENCE_DESKTOP_MIGRATION === "quiesced",
      ...(selected ? { selectedWorkspace: z.uuid().parse(selected) } : {}),
      ...(vault ? { vault } : {}),
      signal,
    });
    return {
      ...settings,
      CADENCE_SQLITE_PATH: join(prepared.directory, "cadence-next.sqlite"),
      CADENCE_LOCAL_WORKSPACE: prepared.workspaceId,
    };
  }
  const connection = sqliteConnection(settings.CADENCE_SQLITE_PATH);
  try {
    await migrateSqlite(connection);
  } finally {
    connection.close();
  }
  signal.throwIfAborted();
  return settings;
}
