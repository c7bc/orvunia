import type { RichContext, RichNotes, RichOptions } from "./contracts.js";
import { createRichElements, richListeners } from "./elements.js";
import { createNotesEditor } from "./editor.js";
import { createRichToolbar } from "./toolbar.js";
import { createRichMode } from "./mode.js";
export { requiresSource } from "./source.js";
export type { RichNotes } from "./contracts.js";

export function mountRichNotes(
  field: HTMLTextAreaElement,
  options: RichOptions,
): RichNotes {
  const elements = createRichElements(field),
    listeners = richListeners();
  const context: RichContext = {
    field,
    elements,
    options,
    editor: null,
    source: false,
    value: field.value,
    silent: false,
    editable: false,
    destroyed: false,
    strings: options.strings,
  };
  const updateTools = createRichToolbar(context, listeners);
  const editor = createNotesEditor(context, updateTools);
  context.editor = editor;
  const mode = createRichMode(context, updateTools);
  listeners.listen(elements.toggle, "click", mode.toggle);
  listeners.listen(field, "input", () => {
    context.value = field.value;
  });
  mode.setValue(context.value);
  return {
    shell: elements.shell,
    editor,
    field,
    setValue: mode.setValue,
    setEditable(next) {
      if (context.destroyed) return;
      context.editable = next;
      editor.setEditable(next, false);
      field.readOnly = !next;
      mode.refresh();
    },
    translate(next) {
      if (context.destroyed) return;
      const changed =
        next.label !== context.strings.label ||
        next.placeholder !== context.strings.placeholder;
      context.strings = next;
      editor.view.dom.setAttribute("aria-label", next.label || options.label);
      if (changed)
        editor.view.dispatch(editor.state.tr.setMeta("notesLocale", true));
      elements.tools.setAttribute("aria-label", next.formatting || "");
      for (const button of elements.tools.querySelectorAll("button")) {
        button.title = next[button.dataset.notesFormat || ""] || "";
        button.setAttribute("aria-label", button.title);
      }
      mode.refresh();
    },
    focus() {
      if (context.destroyed) return;
      if (context.source) field.focus({ preventScroll: true });
      else editor.commands.focus(undefined, { scrollIntoView: false });
    },
    destroy() {
      if (context.destroyed) return;
      context.destroyed = true;
      listeners.close();
      editor.destroy();
      elements.shell.replaceWith(field);
      field.hidden = false;
    },
  };
}
