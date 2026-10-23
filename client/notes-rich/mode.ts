import type { RichContext } from "./contracts.js";
import { requiresSource } from "./source.js";
export function createRichMode(context: RichContext, updateTools: () => void) {
  const { field, elements } = context;
  const ready = context.editor;
  if (!ready) throw Error("Notes editor is not initialized");
  const editor = ready;
  function refresh() {
    field.hidden = !context.source;
    elements.surface.hidden = context.source;
    elements.toggle.textContent =
      (context.source ? context.strings.visual : context.strings.source) || "";
    elements.toggle.setAttribute("aria-label", elements.toggle.textContent);
    elements.toggle.setAttribute("aria-pressed", String(context.source));
    elements.hint.textContent =
      context.source && requiresSource(context.value)
        ? context.strings.preserved || ""
        : "";
    elements.hint.hidden = !elements.hint.textContent;
    elements.toggle.disabled = !context.editable;
    updateTools();
  }
  function content(value: string) {
    context.silent = true;
    try {
      editor.commands.setContent(value, {
        contentType: "markdown",
        emitUpdate: false,
      });
    } finally {
      context.silent = false;
    }
  }
  function setValue(next: string) {
    if (context.destroyed || (next === context.value && editor.getText()))
      return;
    context.value = next;
    field.value = next;
    if (requiresSource(next)) context.source = true;
    content(context.source ? "" : next);
    refresh();
  }
  function toggle() {
    if (!context.editable || context.destroyed) return;
    if (context.source && requiresSource(context.value)) {
      elements.hint.textContent = context.strings.preserved || "";
      elements.hint.hidden = false;
      field.focus();
      return;
    }
    context.source = !context.source;
    if (!context.source) content(context.value);
    refresh();
    if (context.source) field.focus();
    else editor.commands.focus(undefined, { scrollIntoView: false });
  }
  return { refresh, setValue, toggle };
}
