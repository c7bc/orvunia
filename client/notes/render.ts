import { t, currentLocale } from "@cadence/i18n";
import type { RichNotes } from "@cadence/notes-rich";
import type { SessionNotesClient } from "./controller";
import { editorStrings, noteMessages, noteRegion } from "./strings";
export function renderNote(
  field: HTMLTextAreaElement,
  rich: RichNotes | null,
  client: SessionNotesClient,
  signal: AbortSignal,
) {
  const state = client.get(field.dataset.session!),
    doc = field.ownerDocument;
  field.readOnly = !state.loaded;
  field.setAttribute("aria-busy", String(!state.loaded));
  if (field.value !== state.text && state.loaded) {
    const start = field.selectionStart,
      end = field.selectionEnd;
    field.value = state.text;
    if (doc.activeElement === field)
      field.setSelectionRange(
        Math.min(start, field.value.length),
        Math.min(end, field.value.length),
      );
  }
  field.style.height = "auto";
  field.style.height = Math.max(160, field.scrollHeight) + "px";
  if (rich) {
    if (state.loaded) rich.setValue(state.text);
    rich.setEditable(state.loaded);
    rich.translate(editorStrings());
  }
  const status =
    noteRegion(field)?.querySelector<HTMLElement>("[data-note-status]");
  if (
    !status ||
    (status.dataset.noteState === state.status &&
      status.dataset.noteLocale === currentLocale())
  )
    return;
  status.replaceChildren();
  status.dataset.i18nSkip = "";
  status.dataset.noteState = state.status;
  status.dataset.noteLocale = currentLocale();
  status.setAttribute(
    "role",
    ["error", "conflict"].includes(state.status) ? "alert" : "status",
  );
  status.setAttribute("aria-live", "polite");
  const message = doc.createElement("span");
  message.className = "session-note-message";
  message.textContent = t(
    state.status === "error" && !state.loaded
      ? "Não foi possível carregar suas notas."
      : noteMessages[state.status],
  );
  status.append(message);
  const button = (text: string, handler: () => unknown) => {
    const element = doc.createElement("button");
    element.type = "button";
    element.className = "session-notes-action";
    element.textContent = t(text);
    element.addEventListener("click", handler, { signal });
    status.append(element);
  };
  if (state.status === "error")
    button("Tentar novamente", () =>
      state.loaded
        ? client.flush(state.id)
        : client.load(state.id, field.defaultValue),
    );
  if (state.conflict) {
    button("Manter minhas notas", () => client.keepMine(state.id));
    button("Usar versão salva", () => client.useServer(state.id));
  }
}
