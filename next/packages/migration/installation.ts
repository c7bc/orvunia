import { join } from "node:path";
import { prepareLegacyImport } from "./staging.ts";
import { writeLegacyLocal } from "./local.ts";
import {
  installationFiles,
  archiveInstallationFiles,
} from "./installation-files.ts";
import { legacyReader } from "./reader.ts";
import { onboardingSchema } from "../contracts/onboarding.ts";
import { readPrivateFile } from "../providers/private-file.ts";
import { fileVault } from "../providers/vault.ts";
import { scopedCalendarVault } from "../calendar/scoped-vault.ts";
import { legacyCalendarVault } from "./legacy-calendar-vault.ts";
import { projectInstallationCalendar } from "./installation-calendar.ts";
import { migrateInstallationProviders } from "./installation-providers.ts";
import type { SecretVault } from "../providers/domain.ts";
export type InstallationOptions = {
  quiesced: boolean;
  vault?: SecretVault;
  calendarSecret?: string;
  calendarVault?: SecretVault;
};
export async function prepareLegacyInstallation(
  source: string,
  destination: string,
  options: InstallationOptions,
  deployment: "local" | "cloud" = "local",
) {
  if (!options.quiesced)
    throw Error(
      "Stop legacy application writes before staging the complete installation",
    );
  const files = await installationFiles(source, destination, deployment),
    prepared = await prepareLegacyImport(
      files.path("cadence.sqlite"),
      destination,
    ),
    { projection, manifest, root } = prepared,
    archived = await archiveInstallationFiles(files, root);
  let onboarding = 0;
  for (const name of ["onboarding.sqlite", "calendar.sqlite"]) {
    if (!files.names.has(name)) continue;
    const reader = await legacyReader(files.path(name));
    try {
      const supported =
        name === "onboarding.sqlite"
          ? ["onboarding"]
          : ["calendar_connections", "calendar_oauth_states"];
      for (const table of reader.tables)
        if (!supported.includes(table) && reader.count(table) > 0)
          throw Error("Unknown auxiliary table requires migration review");
      if (name === "onboarding.sqlite")
        for (const row of reader.rows("onboarding")) {
          const workspace = projection.workspaces.find(
            (value) => value.id === row.owner_id,
          );
          if (!workspace)
            throw Error("Legacy onboarding has inconsistent ownership");
          workspace.onboarding = onboardingSchema.parse(
            JSON.parse(String(row.state)),
          );
          onboarding++;
        }
      else {
        const localKey = files.names.has(".calendar-key")
            ? await readPrivateFile(
                join(archived.directory, ".calendar-key"),
                32,
              )
            : undefined,
          legacyOpen = legacyCalendarVault({
            ...(options.vault ? { vault: options.vault } : {}),
            ...(localKey ? { localKey } : {}),
            ...(options.calendarSecret
              ? { secret: options.calendarSecret }
              : {}),
          }),
          target =
            options.calendarVault ??
            (options.vault
              ? scopedCalendarVault(options.vault)
              : fileVault(
                  join(root, "calendar.next.key"),
                  "cadence.calendar/v1",
                ));
        await projectInstallationCalendar(
          reader,
          projection,
          legacyOpen,
          target,
          Date.parse(manifest.createdAt),
        );
      }
      await reader.archive(join(archived.directory, name));
      archived.archives.push({ name, sha256: reader.hash });
    } finally {
      reader.close();
    }
  }
  if (files.names.has("providers.json"))
    await migrateInstallationProviders(
      join(archived.directory, "providers.json"),
      join(root, "providers.next.json"),
      options.vault,
    );
  manifest.installation = {
    onboarding,
    calendars: projection.calendars.length,
    privateFiles: archived.archives.length,
    archives: archived.archives,
  };
  return { ...prepared, files };
}
export async function stageLegacyInstallation(
  source: string,
  destination: string,
  options: InstallationOptions,
) {
  return writeLegacyLocal(
    await prepareLegacyInstallation(source, destination, options),
  );
}
