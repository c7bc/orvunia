import { t } from "@cadence/i18n";
import { mountRichNotes } from "@cadence/notes-rich";
import type { RichNotes } from "@cadence/notes-rich";
import { createSessionNotesClient } from "./controller";
import { requestNote } from "./http";
import { renderNote } from "./render";
import { editorStrings, noteRegion } from "./strings";
type MountedNote = { abort: AbortController; rich: RichNotes | null };
export function installSessionNotes(root: Document | HTMLElement = document) {
  const doc = root.ownerDocument ?? (root as Document),
    view = doc.defaultView;
  if (!view) throw Error("O editor precisa de uma janela ativa.");
  const abort = new AbortController(),
    mounted = new Map<HTMLTextAreaElement, MountedNote>();
  const render = (field: HTMLTextAreaElement) =>
    renderNote(field, mounted.get(field)?.rich ?? null, client, abort.signal);
  const client = createSessionNotesClient({
    request: requestNote,
    onChange(id) {
      for (const [field] of mounted)
        if (field.dataset.session === id && field.isConnected) render(field);
    },
  });
  const fields = () => [
    ...root.querySelectorAll<HTMLTextAreaElement>(
      "textarea[data-session-notes][data-session]",
    ),
  ];
  function scan() {
    for (const [field, controller] of mounted)
      if (!field.isConnected) {
        controller.abort.abort();
        controller.rich?.destroy();
        mounted.delete(field);
        void client.flush(field.dataset.session!);
      }
    for (const field of fields()) {
      if (mounted.has(field)) continue;
      const controller: MountedNote = {
          abort: new AbortController(),
          rich: null,
        },
        id = field.dataset.session!;
      mounted.set(field, controller);
      field.addEventListener("input", () => client.edit(id, field.value), {
        signal: controller.abort.signal,
      });
      controller.rich = mountRichNotes(field, {
        label: t("Notas pessoais"),
        placeholder: field.placeholder,
        strings: editorStrings(),
        onChange: (text) => client.edit(id, text),
        onBlur: () => {
          void client.flush(id);
        },
        onLimit: () => {
          const status = noteRegion(field)?.querySelector("[data-note-status]");
          if (status)
            status.textContent = t(
              "As notas podem ter no máximo 100.000 caracteres.",
            );
        },
      });
      field.addEventListener(
        "focusout",
        () => {
          void client.flush(id);
        },
        { signal: controller.abort.signal },
      );
      void client.load(id, field.defaultValue).then(() => render(field));
      render(field);
    }
  }
  const observer = new view.MutationObserver(scan);
  observer.observe(root, { subtree: true, childList: true });
  view.addEventListener(
    "cadence:locale",
    () => {
      for (const [field] of mounted) render(field);
    },
    { signal: abort.signal },
  );
  view.addEventListener(
    "pagehide",
    () => {
      void client.flushAll();
    },
    { signal: abort.signal },
  );
  doc.addEventListener(
    "visibilitychange",
    () => {
      if (doc.visibilityState === "hidden") void client.flushAll();
    },
    { signal: abort.signal },
  );
  scan();
  let retained: {
    field: HTMLTextAreaElement;
    rich: RichNotes;
    focused: boolean;
  }[] = [];
  return {
    beforeRender() {
      retained = [...mounted].flatMap(([field, controller]) =>
        field.isConnected && controller.rich
          ? [
              {
                field,
                rich: controller.rich,
                focused: controller.rich.shell.contains(doc.activeElement),
              },
            ]
          : [],
      );
    },
    afterRender() {
      for (const { field, rich, focused } of retained) {
        const replacement = fields().find(
          (candidate) =>
            candidate.dataset.session === field.dataset.session &&
            candidate !== field,
        );
        if (replacement) {
          replacement.replaceWith(rich.shell);
          if (focused) rich.focus();
        }
      }
      retained = [];
      scan();
    },
    flush: client.flush,
    settle: client.settle,
    reset: client.reset,
    value: client.value,
    prepareGenerated: client.prepareGenerated,
    applyGenerated: client.applyGenerated,
    dispose() {
      observer.disconnect();
      abort.abort();
      for (const controller of mounted.values()) {
        controller.abort.abort();
        controller.rich?.destroy();
      }
      mounted.clear();
      client.dispose();
    },
  };
}
