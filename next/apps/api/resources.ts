import { Elysia } from "elysia";
import { HttpError } from "../../packages/http/errors.ts";
import type { ApiDependencies } from "./core-dependencies.ts";
import { conversationRoutes } from "./routes.ts";
import { workspaceRoutes } from "./workspaces.ts";
import { sessionRoutes } from "./sessions.ts";
import { assetRoutes } from "./assets.ts";
import { providerRoutes } from "./providers.ts";
import { answerRoutes } from "./answers.ts";
import { transcriptionRoutes } from "./transcription.ts";
import { onboardingRoutes } from "./onboarding.ts";
import { bootstrapRoutes } from "./bootstrap.ts";
import { productRoutes } from "./product.ts";
import { expansionRoutes } from "./expansions.ts";
import { realtimeRoutes } from "./realtime.ts";
import { calendarRoutes } from "./calendar.ts";
import { followupRoutes } from "./followups.ts";
import { publicRoutes } from "./public.ts";
import { personalRoutes } from "./personal.ts";
import { documentExtractor } from "../../packages/assets/extract.ts";
import { updateRoutes } from "./updates.ts";
import { manualNotesRoutes } from "./manual-notes.ts";
import { connectionRoutes } from "../../packages/connections/routes.ts";
import { localModelRoutes } from "./local-models.ts";
import { nativeModelRoutes } from "./native-models.ts";
import { localBenchmarkRoutes } from "./local-benchmarks.ts";
import { repositoryAgentRoutes } from "./repository-agent.ts";
import { repositoryPreparationRoutes } from "./repository-preparation.ts";

export function resourceRoutes(dependencies: ApiDependencies) {
  const routes = new Elysia({ name: "resources" });
  const documents = dependencies.documents ?? documentExtractor();
  routes.use(publicRoutes(dependencies));
  const identity = dependencies.identity;
  routes.use(conversationRoutes(dependencies.conversations, identity));
  for (const prefix of ["/api", "/api/v1"]) {
    if (dependencies.repositoryAgent && dependencies.workspace)
      routes.use(repositoryPreparationRoutes(identity, dependencies.workspace.service,
        dependencies.repositoryAgent.sessions, prefix));
    if (dependencies.repositoryAgent) routes.use(repositoryAgentRoutes(dependencies.repositoryAgent.service,
      identity, dependencies.repositoryAgent.sessions, prefix));
    if (dependencies.connections)
      routes.use(connectionRoutes({ ...dependencies.connections, prefix,
        async authorize(request) {
          if (!(await identity.resolve(request)))
            throw new HttpError("unauthorized", 401);
        } }));
    if (dependencies.localModels) {
      routes.use(localModelRoutes(dependencies.localModels, identity, prefix));
      routes.use(localBenchmarkRoutes(dependencies.localModels.benchmarks, identity, prefix));
    }
    if (dependencies.localModels && dependencies.nativeModels)
      routes.use(nativeModelRoutes(dependencies.localModels, identity, dependencies.nativeModels.verify, prefix));
    routes.use(manualNotesRoutes(dependencies.conversations, identity, prefix));
    if (dependencies.updates)
      routes.use(updateRoutes(dependencies.updates, identity, prefix));
    routes.use(personalRoutes(identity, dependencies.resetWorkspace, prefix));
    const {
      workspace,
      sessions,
      assets,
      providers,
      answers,
      transcription,
      expansions,
      realtime,
    } = dependencies;
    if (workspace) {
      routes.use(
        workspaceRoutes(workspace.service, workspace.modes, identity, prefix),
      );
      routes.use(onboardingRoutes(workspace.service, identity, prefix));
    }
    if (sessions)
      routes.use(
        sessionRoutes(sessions, dependencies.conversations, identity, prefix),
      );
    if (assets) routes.use(assetRoutes(assets, identity, prefix));
    if (providers && !dependencies.extension?.excludeResource?.("providers"))
      routes.use(
        providerRoutes(
          providers.settings,
          identity,
          prefix,
          providers.transport,
          dependencies.realtimeAvailable,
        ),
      );
    if (answers && !dependencies.extension?.excludeResource?.("answers")) routes.use(answerRoutes(answers, identity, prefix));
    if (transcription)
      routes.use(transcriptionRoutes(transcription, identity, prefix));
    if (expansions) routes.use(expansionRoutes(expansions, identity, prefix));
    if (realtime) routes.use(realtimeRoutes(realtime, identity, prefix));
    if (dependencies.followups)
      routes.use(followupRoutes(dependencies.followups, identity, prefix));
    if (dependencies.calendar)
      routes.use(
        calendarRoutes(
          dependencies.calendar,
          identity,
          prefix,
          dependencies.deployment !== "cloud",
        ),
      );
    routes.use(bootstrapRoutes(dependencies, prefix));
    routes.use(productRoutes(dependencies, prefix, documents));
  }
  if (dependencies.extension) routes.use(dependencies.extension.routes(identity));
  return routes;
}
