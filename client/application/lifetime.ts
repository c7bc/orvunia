import type { ApplicationContext } from "./context.js";
import { brandMark } from "../design/brand.js";
import { createApplicationSynchronization } from "./synchronization.js";
import { createApplicationStartup } from "./startup.js";
import {
  createRendererShutdown,
  settleRendererTasks,
} from "../sessions/shutdown.js";
export function createApplicationLifetime(context: ApplicationContext) {
  const { state, environment } = context,
    { document, window } = environment;
  const synchronization = createApplicationSynchronization({
    state,
    storage: window.localStorage,
    request: context.request,
    clearTimer: (timer) => {
      if (timer !== null) window.clearTimeout(timer);
    },
    releaseWorkspace() {
      context.transcripts.reset();
      context.repository.reset();
      context.coding.prepared.cancel();
      context.coding.coding.dispose();
      context.coding.tellMore.reset();
      context.titles.reset();
      context.notes.reset();
      context.lifecycle.reset();
      context.references.reset();
      context.captures.crop.cancel();
      context.audioFeature.transcription.reset();
      void context.audioFeature.listening
        .reset()
        .catch((error) =>
          context.modal.toast(
            error instanceof Error
              ? error.message
              : "Não foi possível concluir o áudio.",
          ),
        );
      context.historyPager.clear();
      context.historyDom.clear();
      context.reviewHistoryDom.clear();
      context.prompt.clear();
      context.commandSearch.cancel();
    },
  });
  const startup = createApplicationStartup({
    state,
    storage: window.localStorage,
    search: window.location.search,
    native: context.native,
    sync: synchronization.sync,
    gate: () => context.connections.welcome.gate(),
    locale: (value) => {
      environment.setLocale(value, { notify: false });
    },
    request: context.request,
    clock: environment.clock,
    refreshBilling: async () => { await context.connections.billing?.refresh(); },
    loadCalendar: () => context.connections.calendar.load(),
    resumeListening: id => context.audioFeature.listening.automatic(id),
    prepareRepository: id => context.repository.prepareSession(id),
    replaceLocation: (path) => window.history.replaceState(null, "", path),
    render: () => context.rendering.render(),
    toast: (message) => context.modal.toast(message),
    failed(message, retry) {
      const app = document.querySelector<HTMLElement>("#app");
      if (!app) throw Error("A área do aplicativo não está disponível.");
      app.innerHTML = `<div class="boot"><span class="brand-symbol">${brandMark(32)}</span><h2>Não foi possível abrir seu espaço.</h2><p>${context.presentation.escape(message)}</p><button class="btn" data-action="retry">Tentar novamente</button></div>`;
      const button = app.querySelector<HTMLButtonElement>(
        "[data-action=retry]",
      );
      if (button) button.onclick = retry;
    },
  });
  const shutdown = createRendererShutdown({
    freeze: (value) => {
      document.body.inert = value;
    },
    cancelAnswer() {
      context.transcripts.reset();
      void context.repository.cancel().catch(() => {});
      state.controller?.abort();
      context.connections.gaze.stop();
      context.coding.prepared.cancel();
      context.captures.crop.cancel();
    },
    stopRequests: () =>
      settleRendererTasks([
        () => context.repository.settle(),
        () => context.coding.tellMore.cancelActive(),
        () => context.captures.crop.settle(),
        () => context.audioFeature.transcription.settle(),
        () => context.audioFeature.listening.settle(),
        () => context.commands.settle(),
        () => context.answer.settle(),
      ]),
    async saveTitle() {
      for (const field of document.querySelectorAll<HTMLInputElement>(
        "input[data-session-title]",
      ))
        if (!(await context.titles.save(field)))
          throw Error("Não foi possível salvar o título.");
      await context.titles.settle();
    },
    saveNotes: () => context.notes.settle(),
    stopAudio: () => context.audio.stopConfirmed(),
    async saveElapsed() {
      if (state.view === "overlay" && state.current?.state === "active")
        await context.request(`/sessions/${state.current.id}`, "PATCH", {
          elapsed: context.presentation.duration(),
        });
    },
  });
  return { synchronization, startup, shutdown };
}
