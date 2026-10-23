import type { ApplicationState } from "./model.js";
import type { PanelResponse } from "../panel/data.js";
import type { createCodingWorkspace } from "../coding/workspace.js";
import type { createTellMoreController } from "../coding/controller.js";
import type { createPreparedReveal } from "../coding/reveal.js";
import type { ExpansionChange } from "../coding/expansion.js";
import {
  firstCodeBlock,
  renderCodingEditor,
  renderCaptureQueue,
} from "../coding/render.js";
import { readCommandAttempt } from "../commands/attempt.js";
export function tellMoreLabel(value: Pick<ExpansionChange, "status">) {
  return value.status === "generating"
    ? "Preparando aprofundamento…"
    : value.status === "ready"
      ? "Aprofundamento pronto"
      : value.status === "revealed"
        ? "Ver aprofundamento"
        : value.status === "failed"
          ? "Tentar aprofundar"
          : value.status === "expired"
            ? "Contexto expirado"
            : "Aprofundar";
}
export function createApplicationCodingViews(ports: {
  state: ApplicationState;
  document: Document;
  coding: ReturnType<typeof createCodingWorkspace>;
  tellMore: ReturnType<typeof createTellMoreController>;
  prepared: ReturnType<typeof createPreparedReveal>;
  escape(value: unknown): string;
  escapeSelector(value: string): string;
  translate(value: string): string;
  locale(): string;
  markdown(text: string): string;
  modal(title: string, content: string, className?: string): void;
  toast(message: string): void;
  updateSize(): void;
  scroll(): void;
  decorate(): void;
}) {
  const { state, document, coding } = ports,
    escape = ports.escape,
    t = ports.translate;
  function attemptView() {
    const attempt =
      state.current && readCommandAttempt(coding.get(state.current.id).attempt);
    return attempt
      ? `<article class="response-card coding-attempt"><div class="response-meta">${escape(attempt.cancelled ? "Resposta interrompida" : "Falha na resposta")}</div><p>${escape(t(attempt.message || ""))}</p><p>${escape(t(attempt.request?.prepared ? "A nova tentativa usa o contexto original por até 24 horas. Uma nova pergunta usa o contexto atual." : "O preparo ainda não foi concluído. A nova tentativa preserva a seleção e os anexos desta solicitação."))}</p>${attempt.text ? `<p>${escape("Trecho parcial local; não é uma resposta concluída.")}</p><div class="markdown">${ports.markdown(attempt.text)}</div>` : ""}<div class="coding-response-actions">${attempt.expired ? "" : `<button data-action="coding-retry" ${state.busy ? "disabled" : ""}>${escape(t("Retomar pedido original"))}</button>`}<button data-action="coding-new-attempt" ${state.busy ? "disabled" : ""}>${escape(t("Nova pergunta com contexto atual"))}</button>${attempt.text ? `<button data-action="coding-copy-partial">${escape(t("Copiar trecho parcial"))}</button>` : ""}<button data-action="coding-dismiss">${escape(t("Descartar"))}</button></div></article>`
      : "";
  }
  function responseActions(response: PanelResponse) {
    const current = state.current;
    if (!current) return "";
    const items: [[string, string], ...[string, string][]] = [
      ["explain", "Explicar"],
      ["debug", "Depurar"],
      ["tests", "Testes"],
      ["optimize", "Otimizar"],
      ["expand", "Aprofundar"],
    ];
    return `<div class="coding-response-actions" aria-label="Ações nesta resposta">${items.map(([key, title]) => `<button data-action="coding-${key}:${response.id}" ${key === "expand" ? `data-tell-more-response="${response.id}" data-tell-more-state="${ports.tellMore.get(current.id, response.id).status}"` : ""} ${state.busy || (key === "expand" && ports.tellMore.get(current.id, response.id).status === "expired") ? "disabled" : ""}>${escape(t(key === "expand" ? tellMoreLabel(ports.tellMore.get(current.id, response.id)) : title))}</button>`).join("")}${firstCodeBlock(response.text) ? `<button data-action="coding-use-code:${response.id}" ${state.busy ? "disabled" : ""}>${escape(t("Usar código no editor"))}</button>` : ""}</div>`;
  }
  function refresh(value: ExpansionChange) {
    if (state.current?.id !== value.sessionId) return;
    for (const node of document.querySelectorAll<HTMLButtonElement>(
      "[data-tell-more-response]",
    ))
      if (node.dataset.tellMoreResponse === value.sourceResponseId) {
        node.textContent = t(tellMoreLabel(value));
        node.disabled = state.busy || value.status === "expired";
        node.dataset.tellMoreState = value.status;
        if (value.error) node.title = t(value.error);
      }
  }
  function refreshAll() {
    const current = state.current;
    if (current)
      for (const response of current.responses)
        refresh(ports.tellMore.get(current.id, response.id));
  }
  function paint(text: string) {
    const frame = state.preparedRevealFrame;
    if (
      !frame ||
      state.current?.id !== frame.sessionId ||
      coding.generation !== frame.generation
    )
      return;
    const escaped = ports.escapeSelector(frame.responseId),
      nodes = new Set(
        document.querySelectorAll<HTMLElement>(`[data-markdown="${escaped}"]`),
      );
    for (const action of document.querySelectorAll(
      `[data-action="coding-expand:${escaped}"]`,
    )) {
      const node = action
        .closest("article")
        ?.querySelector<HTMLElement>(".markdown");
      if (node) nodes.add(node);
    }
    const html = ports.markdown(text);
    for (const node of nodes) {
      node.innerHTML = html;
      node.dataset.preparedReveal = frame.done ? "complete" : "animating";
    }
    if (nodes.size) {
      ports.updateSize();
      ports.scroll();
    }
    if (frame.done) {
      state.preparedRevealFrame = null;
      ports.decorate();
    }
  }
  function reapply() {
    const frame = ports.prepared.get();
    if (frame) {
      state.preparedRevealFrame = { ...frame, done: false };
      paint(frame.visibleText);
    }
  }
  function contextEditor() {
    if (!state.current) {
      ports.toast("Inicie uma sessão antes de preparar o contexto técnico.");
      return;
    }
    ports.modal(
      "Enunciado e código",
      renderCodingEditor(
        coding.get(state.current.id),
        state.prefs.code,
        ports.locale(),
      ),
      "coding-dialog",
    );
    const form = document.querySelector<HTMLElement>("#coding-context-form"),
      dialog = document.querySelector<HTMLElement>("#dialogs .coding-dialog");
    if (form) form.dataset.session = state.current.id;
    if (dialog) dialog.dataset.session = state.current.id;
  }
  function captureEditor() {
    if (!state.current) return;
    ports.modal(
      "Capturas pendentes",
      renderCaptureQueue(coding.get(state.current.id), ports.locale()),
      "coding-dialog",
    );
    const dialog = document.querySelector<HTMLElement>(
      "#dialogs .coding-dialog",
    );
    if (dialog) dialog.dataset.session = state.current.id;
  }
  return {
    attemptView,
    responseActions,
    refresh,
    refreshAll,
    paint,
    reapply,
    contextEditor,
    captureEditor,
  };
}
