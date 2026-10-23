import type { ApplicationContext } from "./context.js";
import type { LifecycleState } from "../sessions/lifecycle-types.js";
import type { CommandSession } from "../commands/model.js";
import {
  createSessionLifecycle,
  createTitleEditor,
} from "../sessions/index.js";
import { applicationSession } from "./decoders.js";
export function createApplicationSessions(
  context: Pick<
    ApplicationContext,
    | "state"
    | "environment"
    | "request"
    | "native"
    | "audio"
    | "audioFeature"
    | "presentation"
    | "connections"
    | "modal"
    | "rendering"
    | "synchronization"
    | "repository"
  >,
) {
  const { state, environment } = context,
    presentation = context.presentation;
  const lifecycleState: LifecycleState<CommandSession> = {
    get current() {
      return state.current;
    },
    set current(value) {
      if (state.current?.id !== value?.id)
        void context.audioFeature.listening
          .select(value?.id || null)
          .catch((error) =>
            context.modal.toast(
              error instanceof Error
                ? error.message
                : "Não foi possível selecionar a sessão.",
            ),
          );
      state.current = value;
    },
    get sessions() {
      return state.sessions;
    },
    set sessions(value) {
      state.sessions = value;
    },
    get started() {
      return state.started;
    },
    set started(value) {
      state.started = value;
    },
    get elapsedBase() {
      return state.elapsedBase;
    },
    set elapsedBase(value) {
      state.elapsedBase = value;
    },
    get draft() {
      return state.draft;
    },
    set draft(value) {
      state.draft = value;
    },
    get tab() {
      return state.tab;
    },
    set tab(value) {
      state.tab = value;
    },
    get view() {
      return state.view;
    },
    set view(value) {
      state.view = value;
    },
    get page() {
      return state.page;
    },
    set page(value) {
      state.page = value;
    },
    get audioStatus() {
      return state.audioStatus;
    },
    set audioStatus(value) {
      state.audioStatus = value;
    },
  };
  function detail(value: CommandSession): void {
    state.current = value;
    state.page = "detail";
    state.accountOpen = false;
    state.detailTab = "notes";
    context.rendering.render();
  }
  const lifecycle = createSessionLifecycle({
    state: lifecycleState,
    workspace: () => state.workspaceKey,
    clock: environment.clock,
    duration: presentation.duration,
    base: presentation.modeBase,
    request: async (...args) =>
      applicationSession(await context.request(...args)),
    native: context.native,
    audio: context.audio,
    stopGaze: () => context.connections.gaze.stop(),
    cancelAnswer: () => state.controller?.abort(),
    ambientChat: () => state.desktop.settings.ambientChat === true,
    replaceURL: (url) => environment.window.history.replaceState(null, "", url),
    closeModal: () => context.modal.close(),
    render: () => context.rendering.render(),
    opened: async (id) => {
      if (!context.native || state.view === "overlay") {
        if (await context.repository.prepareSession(id)) return;
        await context.audioFeature.listening.automatic(id);
      }
    },
    detail,
    sync: () => context.synchronization.sync(),
    broadcast: (value) => environment.broadcast.postMessage(value),
  });
  const titles = createTitleEditor({
    current: () => state.current,
    sessions: () => state.sessions,
    replace: (value) => {
      state.sessions = value;
    },
    save: async (sessionId, title, signal) =>
      applicationSession(
        await context.request(
          `/sessions/${sessionId}`,
          "PATCH",
          { title },
          signal,
        ),
      ),
    changed: () => environment.broadcast.postMessage({ type: "changed" }),
    toast: (message) => context.modal.toast(message),
  });
  async function start(mode: string): Promise<void> {
    const { modal } = context.modal,
      { button, escape, modeName } = presentation;
    if (state.current && state.current.state !== "ended") {
      modal(
        "Sessão em andamento",
        `<p>Encerre ou retome sua sessão atual antes de começar outra.</p><div class="form-footer">${button("Retomar", "resume-current", "primary")}${button("Encerrar atual", "end")}</div>`,
      );
      return;
    }
    modal(
      environment.translate("Iniciar {mode}", {
        mode: modeName(mode).toLowerCase(),
      }),
      `<p>Seu perfil e os arquivos de referência estarão disponíveis durante a conversa.</p><form id="start-form" data-mode="${mode}"><div class="fields"><div class="field full"><label for="session-title">Nome da sessão</label><input id="session-title" name="title" required maxlength="200" value="${escape(state.profile?.company ? modeName(mode) + " · " + state.profile.company : modeName(mode))}"></div></div><div class="notice">${state.desktop.settings.autoListen ? "A escuta iniciará com a sessão, conforme as fontes configuradas em Geral." : "A escuta automática está desligada. Clique em “Ouvir conversa” para transcrever e salvar falas."}</div><div class="form-footer">${button("Cancelar", "modal-close")}<button class="btn primary" type="submit">Abrir assistente ${environment.icon("arrow", 15)}</button></div></form>`,
    );
  }
  return { lifecycle, titles, start, detail };
}
