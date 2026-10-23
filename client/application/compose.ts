import type { ApplicationEnvironment } from "./context.js";
import type { RawNative } from "./native.js";
import { createApplicationNative } from "./native.js";
import { createApplicationState } from "./state.js";
import { createApplicationRequest } from "./request.js";
import { projectApplicationContext } from "./projection.js";
import { createApplicationPresentation } from "./presentation.js";
import { createApplicationNavigation } from "./navigation.js";
import { createApplicationComponents } from "./components.js";
import { createApplicationResources } from "./resources.js";
import { createApplicationSessions } from "./sessions.js";
import { createApplicationTranscription } from "./transcription.js";
import { createApplicationReview } from "./review.js";
import { createApplicationStorageOperations } from "./storage-operations.js";
import { createApplicationHistory } from "./history.js";
import { assembleApplicationExport } from "./export.js";
import { createApplicationRendering } from "./rendering.js";
import { createApplicationLifetime } from "./lifetime.js";
import { installApplicationEffects } from "./effects.js";
import { createApplicationCommands } from "./commands.js";
import { applicationCommandPorts } from "./command-ports.js";
import {
  assembleCoding,
  assembleLayout,
  assembleModal,
  assembleMarkdown,
} from "./assembly-views.js";
import {
  assembleAudio,
  assembleUploads,
  assembleCaptures,
  assembleAnswer,
} from "./assembly-media.js";
import { StudioAudio } from "../studio/index.js";
import { createHistoryPager } from "../history/pager.js";
import { createHistoryDomPreserver } from "../history/index.js";
import type { ApplicationEdition } from "../application-services/edition.js";
import { createApplicationRepository } from "./repository.js";

export function createDesktopApplication(
  environment: ApplicationEnvironment,
  rawNative: RawNative | null,
  edition?: ApplicationEdition,
) {
  const { document, window } = environment;
  const state = createApplicationState({
    search: window.location.search,
    storage: window.localStorage,
  });
  const native = createApplicationNative(rawNative, (message) =>
    modal.toast(message),
  );
  const request = createApplicationRequest({
    request: environment.fetch,
    current: () => state.current,
    locale: environment.locale,
  });
  const audio = new StudioAudio(),
    historyPager = createHistoryPager(),
    historyDom = createHistoryDomPreserver(),
    reviewHistoryDom = createHistoryDomPreserver();
  const context = projectApplicationContext(
    {
      state,
      environment,
      native,
      request,
      audio,
      historyPager,
      historyDom,
      reviewHistoryDom,
    },
    {
      presentation: () => presentation,
      navigation: () => navigation,
      markdown: () => markdown,
      layout: () => layout,
      modal: () => modal,
      coding: () => coding,
      answer: () => answer,
      repository: () => repository,
      connections: () => resources.connections,
      modes: () => resources.modes,
      dialogs: () => resources.dialogs,
      microphone: () => resources.microphone,
      audioFeature: () => audioFeature,
      uploads: () => uploads,
      captures: () => captures,
      notes: () => components.notes,
      prompt: () => components.prompt,
      lifecycle: () => sessions.lifecycle,
      titles: () => sessions.titles,
      shutdown: () => lifetime.shutdown,
      references: () => resources.references,
      followup: () => resources.followup,
      history: () => history.history,
      commandSearch: () => history.commandSearch,
      search: () => history.search,
      filteredSessions: () => history.filtered,
      exporter: () => exports.exporter,
      importCalendar: () => exports.importCalendar,
      rendering: () => rendering,
      commands: () => commands,
      synchronization: () => lifetime.synchronization,
      startup: () => lifetime.startup,
      review: () => review,
      sessions: () => sessions,
      storage: () => storage,
      transcripts: () => transcripts,
    },
  );
  const presentation = createApplicationPresentation({
    state,
    clock: environment.clock,
    locale: environment.locale,
    translate: environment.translate,
    icon: environment.icon,
  });
  const navigation = createApplicationNavigation({
    state,
    render: () => context.rendering.render(),
  });
  const coding = assembleCoding(context),
    layout = assembleLayout(context),
    modal = assembleModal(context),
    markdown = assembleMarkdown(context);
  const components = createApplicationComponents({
    state,
    document,
    toast: modal.toast,
    reporting: { locale: environment.locale, modal: modal.modal, close: modal.close,
      copy: environment.markdown.copy,
      ...(native?.openSupportReport ? { open: native.openSupportReport } : {}) },
  });
  const resources = createApplicationResources(context, edition);
  const sessions = createApplicationSessions(context),
    transcripts = createApplicationTranscription(context);
  const audioFeature = assembleAudio(context),
    uploads = assembleUploads(context),
    captures = assembleCaptures(context),
    answer = assembleAnswer(context);
  const history = createApplicationHistory(context),
    storage = createApplicationStorageOperations(context),
    exports = assembleApplicationExport(context);
  const review = createApplicationReview(context),
    lifetime = createApplicationLifetime(context),
    rendering = createApplicationRendering(context);
  const commands = createApplicationCommands({
    state,
    ports: applicationCommandPorts(context),
  });
  commands.install();
  const repository = createApplicationRepository(context);
  const effects = installApplicationEffects(context);
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    window.removeEventListener("beforeunload", dispose);
    effects.dispose();
    commands.dispose();
    repository.dispose();
    answer.dispose();
    transcripts.dispose();
    lifetime.startup.dispose();
    lifetime.synchronization.dispose();
    sessions.titles.dispose();
    lifetime.shutdown.dispose();
    sessions.lifecycle.dispose();
    resources.references.dispose();
    captures.dispose();
    audioFeature.transcription.dispose();
    void audioFeature.listening.dispose().catch(() => {});
    layout.dispose();
    modal.dispose();
    resources.connections.gaze.dispose();
    resources.connections.dispose();
    resources.followup.dispose();
    state.controller?.abort();
    coding.dispose();
    components.dispose();
    history.commandSearch.cancel();
    environment.broadcast.close();
    void audio.stop().catch(() => {});
  }
  window.addEventListener("beforeunload", dispose);
  return { state, start: lifetime.startup.init, dispose };
}
