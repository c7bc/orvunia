import type { ApplicationContext } from "./context.js";
import type { AnswerOptions } from "../answers/domain.js";
import { createRepositoryController } from "../repository/controller.js";
import { createRepositoryAgentRunner } from "../repository/agent-runner.js";
import { installRepositoryInterface } from "../repository/install.js";
import { repositoryMessage } from "../repository/messages.js";
import { createAnswerRequest } from "../answers/request.js";
import { createRepositoryPreparation } from "../repository/preparation.js";
import { preparationMessage } from "../repository/preparation-messages.js";
import { requireRepositoryReview } from "../repository/readiness.js";
import { streamRepositoryTurn } from "../repository/stream.js";
import { createStreamRenderer } from "../coding/paint.js";

export function createApplicationRepository(context: ApplicationContext) {
  const { state, environment } = context;
  let liveRenderer: ReturnType<typeof createStreamRenderer> | null = null;
  let deferred: { sessionId: string; workspace: string; action: string; question: string; options: AnswerOptions } | null = null;
  const preparation = createRepositoryPreparation({
    document: environment.document, native: Boolean(context.native?.repository),
    workspace: () => state.workspaceKey, locale: environment.locale,
    invoke: value => {
      if (!context.native?.repository) throw Error("repository_unavailable");
      return context.native.repository(value);
    },
    changed: () => context.rendering.render(), modal: (...args) => context.modal.modal(...args),
    toast: message => context.modal.toast(message), escape: context.presentation.escape, icon: environment.icon,
  });
  const controller = createRepositoryController({
    current: () => state.current && state.current.state === "active"
      ? { workspaceId: state.workspaceKey.replace(/^cadence-agenda:/, ""), sessionId: state.current.id } : null,
    native: (value) => {
      if (!context.native?.repository) throw Error("repository_unavailable");
      return context.native.repository(value);
    },
    binding: (id, signal) => context.request(`/sessions/${encodeURIComponent(id)}/repository-agent/binding`,
      "GET", undefined, signal),
    locale: environment.locale,
    changed: () => ui.renderIfOpen(),
    async disconnected() {
      const current = state.current;
      if (current && current.id === controller.state.identity?.sessionId)
        await preparation.remove(current.modeId || current.mode);
    },
    onText(text) {
      if (!state.busy || state.controller?.signal.aborted) return;
      state.liveText = text;
      state.answerPhase = text ? "Respondendo…" : repositoryMessage(environment.locale(), "progress");
      liveRenderer?.push(text);
    },
    agent: (ports) => createRepositoryAgentRunner({ ...ports,
      stream: (path, signal) => streamRepositoryTurn((url, options) => environment.fetch("/api" + url, {
        ...options, credentials: "same-origin", headers: { "X-Cadence-Request": "1", "Accept-Language": environment.locale() },
      }), path, signal, ports.onText),
      request: (path, options, signal) => context.request(path, options.method,
        options.body ? JSON.parse(String(options.body)) as unknown : undefined, signal) }),
  });
  const ui = installRepositoryInterface({
    document: environment.document,
    controller,
    available: () => Boolean(context.native?.repository && state.current?.state === "active"),
    locale: environment.locale,
    modal: (...args) => context.modal.modal(...args),
    escape: context.presentation.escape,
    toast: (message) => context.modal.toast(message),
    close: () => context.modal.close(),
    async dismissed() {
      deferred = null;
      const id = controller.state.identity?.sessionId;
      await controller.cancel();
      if (id && state.current?.id === id && state.current.state === "active")
        await context.lifecycle.end();
    },
    async approved() {
      const id = controller.state.identity?.sessionId;
      if (!id || state.current?.id !== id) return;
      const pending = deferred; deferred = null;
      await context.audioFeature.listening.automatic(id);
      if (pending?.sessionId === state.current?.id && pending.workspace === state.workspaceKey)
        await context.answer.ask(pending.action, pending.question, false, pending.options);
    },
  });
  const pendingPreparations = new Map<string, Promise<boolean>>();
  function ensureSession(sessionId: string) {
    const pending = pendingPreparations.get(sessionId);
    if (pending) return pending;
    const task = prepareSession(sessionId).finally(() => pendingPreparations.delete(sessionId));
    pendingPreparations.set(sessionId, task);
    return task;
  }
  async function prepareSession(sessionId: string) {
    if (!context.native?.repository || state.current?.id !== sessionId || state.current.mode !== "technical") return false;
    if (controller.state.identity?.sessionId === sessionId && controller.state.preview) {
      if (controller.isApproved()) return false;
      context.modal.toast(preparationMessage(environment.locale(), "reconnect")); return true;
    }
    const modeId = state.current.modeId || state.current.mode;
    try {
      const prepared = await preparation.status(modeId);
      if (!prepared || state.current?.id !== sessionId) return false;
      if (!prepared.authorized) {
        context.modal.toast(preparationMessage(environment.locale(), "reconnect")); return true;
      }
      await controller.select([], modeId);
      if (!controller.isApproved()) throw Error("repository_consent_required");
      return false;
    } catch {
      context.modal.toast(preparationMessage(environment.locale(), "error"));
      return true;
    }
  }
  return {
    controller,
    preparation,
    prepareSession: ensureSession,
    async ask(action: string, supplied: string | undefined, review: boolean, options: AnswerOptions) {
      const current = state.current;
      if (!current || review || state.view === "control"
        || options.retry || options.applyGenerated || options.captureIds?.length
        || action === "recap" || state.desktop.settings.autoScreen
        || context.coding.coding.get(current.id).captures.length
        || (current.mode === "recruiter" && current.captures.length)) return false;
      const question = supplied ?? environment.document.querySelector<HTMLTextAreaElement>("#question")?.value.trim()
        ?? state.draft.trim();
      if (current.mode === "technical" && context.native?.repository && await requireRepositoryReview({
        approved: () => controller.isApproved(),
        prepared: () => preparation.status(current.modeId || current.mode),
        review: () => ensureSession(current.id),
        failed: () => context.modal.toast(preparationMessage(environment.locale(), "error")),
      })) {
        if (question) {
          state.draft = question;
          deferred = { sessionId: current.id, workspace: state.workspaceKey, action, question, options };
        }
        return true;
      }
      if (!controller.isApproved()) return false;
      if (!question) return false;
      if (state.busy) return true;
      const requestController = new AbortController();
      const request = createAnswerRequest(context.answer.context, context.coding.coding.get(current.id),
        action, question, "", false, options);
      state.controller = requestController;
      state.busy = true;
      state.activeAnswerRequest = request;
      state.liveQuestion = question;
      state.liveText = "";
      state.chatCollapsed = false;
      state.tab = "answers";
      state.answerPhase = repositoryMessage(environment.locale(), "progress");
      context.rendering.render();
      const renderer = createStreamRenderer(text => {
        if (state.activeAnswerRequest === request && state.current?.id === current.id && !requestController.signal.aborted)
          context.answer.paint(text);
      });
      liveRenderer = renderer;
      try {
        const job = await controller.ask(question, requestController.signal, options.sourceTranscriptIds);
        if (job.status === "completed") {
          renderer.flush();
          state.draft = "";
          await context.synchronization.session(current.id);
          environment.broadcast.postMessage({ type: "session-changed", sessionId: current.id });
        } else context.modal.toast(controller.state.error || repositoryMessage(environment.locale(), "error"));
      } catch {
        context.modal.toast(controller.state.error || repositoryMessage(environment.locale(), "error"));
      } finally {
        renderer.cancel();
        if (liveRenderer === renderer) liveRenderer = null;
        if (state.controller === requestController) {
          state.controller = null; state.busy = false; state.answerPhase = "";
          if (state.activeAnswerRequest === request) state.activeAnswerRequest = null;
          state.liveQuestion = ""; state.liveText = "";
          context.rendering.render();
        }
      }
      return true;
    },
    reset() { deferred = null; preparation.reset(); void preparation.cancel().catch(() => {}); void controller.cancel().catch(() => {}); },
    async cancel() { deferred = null; await Promise.all([controller.cancel(), preparation.cancel()]); },
    async settle() { await Promise.all([controller.settle(), preparation.settle()]); },
    dispose() { deferred = null; preparation.dispose(); ui.dispose(); controller.dispose(); },
  };
}
