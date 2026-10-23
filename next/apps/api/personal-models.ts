import { dirname } from "node:path";
import { capabilityRouter } from "../../packages/capabilities/router.ts";
import type { LocalSettings } from "../../packages/config/local.ts";
import type { SqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { composeLocalModels } from "../../packages/local-models/compose.ts";
import { personalProviders } from "../../packages/providers/personal.ts";
import type { Composition } from "./composition.ts";
import { runtimeConfiguration } from "../../packages/local-models/configuration.ts";

export async function personalModels(settings: LocalSettings, composition: Composition, database: SqliteConnection) {
  let providers: Awaited<ReturnType<typeof personalProviders>> | undefined;
  const models = composeLocalModels({
    directory: dirname(settings.CADENCE_SQLITE_PATH), database: database.client,
    runtimes: await runtimeConfiguration(composition.environment),
    async bindings() {
      if (!providers) throw Error("Personal model configuration is not ready");
      return Object.values((await providers.connections.configuration()).bindings)
        .flatMap(binding => binding.kind === "local" ? [binding.installationId] : []);
    },
  });
  try {
    providers = await personalProviders(settings, composition.environment, models, composition.vault);
    models.service.downloads.recoverInterrupted();
    return { providers, models, capabilities: capabilityRouter({ connections: providers.connections,
      models: models.service, transport: composition.transport }) };
  } catch (error) { await models.close(); throw error; }
}
