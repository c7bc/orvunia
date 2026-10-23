import { nativeSelectionVerifier } from "../../packages/local-models/native-proof.ts";
import { composeFollowups } from "./local-followups.ts";
import { SqliteFollowups } from "../../packages/storage/sqlite/followups.ts";
import { sqliteFollowupOutbox } from "../../packages/storage/sqlite/followup-outbox.ts";
import { SqliteExpansions } from "../../packages/storage/sqlite/expansions.ts";
import { SqliteSessionIndex } from "../../packages/storage/sqlite/session-index.ts";
import { composeGeneration } from "./generation.ts";
import { SqliteOperations } from "../../packages/storage/sqlite/operations.ts";
import { SqliteOperationStages } from "../../packages/storage/sqlite/operation-stages.ts";
import { SqliteAccounting } from "../../packages/storage/sqlite/accounting.ts";
import { localAccounting } from "../../packages/accounting/service.ts";
import type { LocalSettings } from "../../packages/config/local.ts";
import type { Composition } from "./composition.ts";
import { sqliteConnection } from "../../packages/storage/sqlite/connection.ts";
import { SqliteAssets } from "../../packages/storage/sqlite/assets.ts";
import { SqliteConversations } from "../../packages/storage/sqlite/conversations.ts";
import { SqliteSessions } from "../../packages/storage/sqlite/sessions.ts";
import { SqliteWorkspaces } from "../../packages/storage/sqlite/workspaces.ts";
import { localAssets as composeAssets } from "../../packages/assets/local.ts";
import { reconciliationLoop } from "../../packages/assets/reconciliation.ts";
import { schemaReadiness } from "../../packages/storage/readiness.ts";
import { localIdentity } from "../../packages/identity/local.ts";
import { personalModels } from "./personal-models.ts";
import { connectionProbe } from "../../packages/providers/connection-probe.ts";
import { applicationServices } from "./application-services.ts";
import { createCoreApi as createApi } from "./core-app.ts";
import { composeLive } from "./live.ts";
import { composeCalendar } from "./local-calendar.ts";
import { SqliteCalendar } from "../../packages/storage/sqlite/calendar.ts";
import { sqlitePersonal } from "../../packages/storage/sqlite/personal.ts";
import { personalWorkspace } from "../../packages/workspaces/personal.ts";
import { staticClient } from "../../packages/client/static.ts";
import { applicationLifetime } from "../../packages/runtime/application-lifetime.ts";
import { documentExtractor } from "../../packages/assets/extract.ts";
import { localBrowserSession } from "../../packages/identity/local-browser.ts";
import { updateService } from "../../packages/updates/service.ts";
import { localRepository } from "./local-repository.ts";
import { repositorySessionScope } from "../../packages/repository-agent/session-scope.ts";

export async function composeLocal(
  settings: LocalSettings,
  composition: Composition,
) {
  const connection = sqliteConnection(settings.CADENCE_SQLITE_PATH);
  const lifetime = applicationLifetime();
  lifetime.resource(() => connection.close());
  const documents = documentExtractor();
  lifetime.activity(documents.close);
  try {
    const updates = updateService({
      feedUrl: composition.environment.CADENCE_UPDATE_FEED_URL,
      transport: composition.transport,
      clock: Date.now,
    });
    lifetime.activity(updates.close);
    if (settings.CADENCE_LOCAL_BROWSER && !composition.clientDirectory)
      throw Error("Local browser mode requires the client directory");
    const browser = settings.CADENCE_LOCAL_BROWSER
      ? localBrowserSession(settings.CADENCE_PUBLIC_URL)
      : null;
    if (browser) lifetime.resource(browser.close);
    const client = composition.clientDirectory
      ? await staticClient(
          composition.clientDirectory,
          composition.clientVendorDirectory,
        )
      : null;
    const repositoryScope = repositorySessionScope(new SqliteSessions(connection));
    const sessions = repositoryScope.sessions;
    const assetRepository = new SqliteAssets(connection);
    const services = applicationServices({
      index: new SqliteSessionIndex(connection),
      workspaces: new SqliteWorkspaces(connection),
      conversations: new SqliteConversations(connection),
      sessions,
    });
    const schemaReady = await schemaReadiness("sqlite");
    const { providers, models, capabilities } = await personalModels(settings, composition, connection);
    lifetime.activity(models.close);
    const assets = await composeAssets(settings, assetRepository);
    lifetime.resource(assets.close);
    const accounting = new SqliteAccounting(connection);
    const generation = composeGeneration(
      {
        sessions,
        stages: new SqliteExpansions(connection),
        workspace: services.workspace.service,
        assets: assetRepository,
        objects: assets.objects,
        operations: new SqliteOperations(connection),
        operationStages: new SqliteOperationStages(connection),
        providers,
        capabilities,
        transport: composition.transport,
        log: composition.log,
      },
      localAccounting(accounting, () => Bun.randomUUIDv7(), Date.now),
      (now) => accounting.markExpiredUnknown(now),
      true,
    );
    lifetime.activity(generation.close);
    const repositoryAgent = localRepository(connection, sessions, generation.usage, providers, composition.transport,
      services.workspace.service);
    lifetime.activity(repositoryAgent.service.close);
    repositoryScope.onInvalidate(repositoryAgent.service.invalidate);
    const personal = sqlitePersonal(
      connection,
      settings.CADENCE_LOCAL_WORKSPACE,
    );
    const identity = localIdentity(
      settings.CADENCE_LOCAL_TOKEN,
      settings.CADENCE_LOCAL_WORKSPACE,
      personal.current,
      browser?.authorize,
    );
    const live = composeLive(settings.CADENCE_PUBLIC_URL, composition, {
      sessions,
      identity,
      workspace: services.workspace.service,
      providers,
      usage: generation.usage,
    });
    lifetime.activity(live.close);
    const calendar = composeCalendar(
      settings,
      composition,
      new SqliteCalendar(connection),
    );
    lifetime.activity(calendar.close);

    lifetime.activity(
      reconciliationLoop(assets.service, () =>
        composition.log({ event: "asset_cleanup_failed" }),
      ),
    );
    const followup = composeFollowups(
      settings,
      composition,
      sessions,
      new SqliteFollowups(connection),
      (cipher) => sqliteFollowupOutbox(connection, cipher),
    );
    lifetime.activity(followup.close);
    const api = createApi({
      repositoryAgent,
      localModels: models.service,
      nativeModels: { verify: nativeSelectionVerifier(settings.CADENCE_LOCAL_TOKEN, settings.CADENCE_PUBLIC_URL) },
      connections: { service: providers.connections, probe: connectionProbe(composition.transport) },
      updates,
      documents,
      ...(client ? { client: browser ? browser.wrap(client) : client } : {}),
      resetWorkspace: personalWorkspace({
        repository: personal,
        identifier: () => crypto.randomUUID(),
        clock: Date.now,
        stop: live.stopWorkspace,
        log: composition.log,
      }).reset,
      followups: followup.service,
      deployment: "local",
      realtime: live,
      calendar,
      realtimeAvailable: true,
      ...services,
      answers: generation.service,
      expansions: generation.details,
      transcription: generation.audio,
      maximumBodyBytes: 26 * 1024 * 1024,
      assets: assets.service,
      providers: { settings: providers, transport: composition.transport },
      origin: settings.CADENCE_PUBLIC_URL,
      log: composition.log,
      identity,
      ready: async () =>
        schemaReady(
          connection.client
            .query<{ name: string; hash: string }, []>(
              "SELECT name,hash FROM next_migrations",
            )
            .all(),
        ),
    });
    return { api, drain: lifetime.drain, close: lifetime.close };
  } catch (error) {
    try {
      await lifetime.close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "API initialization failed",
      );
    }
    throw error;
  }
}
