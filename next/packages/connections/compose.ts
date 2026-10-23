import { join } from "node:path";
import { fileConnections } from "../providers/file.ts";
import type { Connections as LegacyConnections } from "../providers/domain.ts";
import type { Vault } from "./domain.ts";
import { fileConfiguration } from "./file.ts";
import { promoteConfiguration } from "./promotion.ts";
import { migrateConnections } from "./migration.ts";
import { connectionService, type ConnectionDependencies } from "./service.ts";
export async function composeConnections(options: {
  directory: string; vault: Vault; initial: LegacyConnections;
  environment: { trusted(role: "response" | "transcription", provider: string, baseUrl: string): boolean };
  installationSupports: ConnectionDependencies["installationSupports"];
  environmentKey: ConnectionDependencies["environmentKey"];
}) {
  const filename = join(options.directory, "providers.v2.json");
  const repository = fileConfiguration(filename, options.vault);
  await promoteConfiguration({ repository, filename,
    journal: join(options.directory, "providers.v2.migration.json"),
    async initial() {
      const legacy = await fileConnections(join(options.directory, "providers.next.json"), options.vault).read();
      return migrateConnections(legacy ?? options.initial, options.environment);
    },
  });
  return connectionService({ repository,
    installationSupports: options.installationSupports, environmentKey: options.environmentKey });
}
