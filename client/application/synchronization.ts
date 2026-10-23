import type { ApplicationState } from "./model.js";
import type { ApplicationStorage } from "./storage.js";
import { readAgenda } from "./storage.js";
import { createSessionSynchronization } from "./session-synchronization.js";
import {
  applicationBootstrap,
  applicationHealth,
  applicationLibrary,
  applicationModes,
  applicationProviders,
  applicationSession,
} from "./decoders.js";

export function createApplicationSynchronization(ports: {
  state: ApplicationState;
  storage: ApplicationStorage;
  request(path: string): Promise<unknown>;
  releaseWorkspace(): void;
  clearTimer(timer: number | null): void;
}) {
  const { state } = ports;
  let generation = 0,
    disposed = false;
  const session = createSessionSynchronization({ ...ports, generation: () => generation });
  function reset() {
    state.controller?.abort();
    ports.releaseWorkspace();
    state.voiceActivity.clear();
    state.partialTranscripts.clear();
    state.audioPending.clear();
    state.modeDrafts.clear();
    state.accountMarkup = {};
    state.accountLoading.clear();
    state.reviewChatSessionId = null;
    state.detailDrafts.clear();
    state.current = null;
    state.sessionSearchItems = [];
    state.sessionSearchBefore = null;
    state.sessionSearchQuery = "";
    state.sessionSearchEpoch++;
    ports.clearTimer(state.sessionSearchTimer);
    state.sessionSearchTimer = null;
    state.recapGeneration = state.generatedRecapFallback = null;
  }
  async function sync() {
    if (disposed) return;
    const epoch = ++generation;
    const boot = applicationBootstrap(
      await ports.request("/bootstrap?compact=1"),
    );
    if (disposed || epoch !== generation) return;
    const [library, health, modes] = await Promise.all([
      ports.request("/library").then(applicationLibrary),
      ports.request("/health").then(applicationHealth),
      ports.request("/modes").then(applicationModes),
    ]);
    const providers = health.deployment === "cloud" ?
      applicationProviders({ edition: "cloud", editable: false, protection: "managed" }) :
      applicationProviders(await ports.request("/providers"));
    if (disposed || epoch !== generation) return;
    const key = "cadence-agenda:" + boot.workspaceId;
    if (state.workspaceKey !== "cadence-agenda" && state.workspaceKey !== key)
      reset();
    state.sessions = boot.sessions;
    state.sessionIndexBefore = boot.before;
    state.profile = boot.profile;
    state.prefs = boot.preferences;
    state.library = library;
    state.health = health;
    state.providerState = providers;
    state.workspaceKey = key;
    state.agenda = readAgenda(
      ports.storage,
      key,
      health.deployment === "local",
    );
    state.modes = modes.modes;
    state.modeTemplates = modes.templates || [];
    state.selectedMode = modes.activeId;
    if (!state.modes.some((mode) => mode.id === state.modeEditor))
      state.modeEditor = state.selectedMode;
    const selected = state.current?.id;
    if (!selected) return;
    try {
      const current = applicationSession(
        await ports.request("/sessions/" + selected),
      );
      if (
        !disposed &&
        epoch === generation &&
        state.current?.id === selected &&
        state.workspaceKey === key
      )
        state.current = current;
    } catch (error) {
      if (
        !disposed &&
        epoch === generation &&
        state.current?.id === selected &&
        state.workspaceKey === key
      ) {
        if (
          error &&
          typeof error === "object" &&
          "status" in error &&
          error.status === 404
        )
          state.current = null;
        else throw error;
      }
    }
  }
  return {
    sync,
    session: session.refresh,
    dispose() {
      disposed = true;
      generation++;
      session.dispose();
    },
  };
}
