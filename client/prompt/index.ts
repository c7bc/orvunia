import { promptSelector } from "./contracts.js";
import type { PromptOptions, PromptRoot } from "./contracts.js";
import { promptJournal } from "./journal.js";
import { applyPromptFormat } from "./format.js";
import { bindPrompt } from "./bind.js";
export { formatPromptSelection } from "./selection.js";
export { createCaptureCrop } from "../captures/crop.js";
export {
  createReferenceImporter,
  chooseReferenceFiles,
} from "../documents/index.js";
export function installModePromptEditor(
  root: PromptRoot = document,
  {
    getKey = (field) => field.dataset.modePrompt || (field.id === "system-prompt" ? "system:default" : "default"),
    onChange = () => {},
    onLimit = () => {},
  }: PromptOptions = {},
) {
  const owner = (root.ownerDocument || root) as Document,
    view = owner.defaultView;
  if (!view) throw TypeError("Prompt editor requires a document window");
  let active: HTMLTextAreaElement | null = null,
    disposed = false;
  let retained: {
    field: HTMLTextAreaElement;
    key: string | undefined;
    focused: boolean;
  }[] = [];
  const journal = promptJournal((field) =>
    onChange(field.value, field.dataset.modePrompt, field),
  );
  const dispatch = (field: HTMLTextAreaElement) =>
    field.dispatchEvent(
      new (view as Window & typeof globalThis).Event("input", {
        bubbles: true,
      }),
    );
  function scan(preferred?: HTMLTextAreaElement) {
    if (disposed) return;
    const fields = [...root.querySelectorAll<HTMLTextAreaElement>(promptSelector)];
    for (const field of fields) {
      if (!field.dataset.modePrompt) field.dataset.modePrompt = String(getKey(field));
      journal.record(field);
    }
    active = preferred && fields.includes(preferred) ? preferred
      : fields.find(field => field === owner.activeElement)
        ?? (active && fields.includes(active) ? active : fields[0] ?? null);
  }
  function history(redo = false, preferred?: HTMLTextAreaElement) {
    scan(preferred);
    const field = active;
    if (!field || field.disabled || field.readOnly) return false;
    return journal.history(field, redo, () => dispatch(field));
  }
  function format(kind: string, preferred?: HTMLTextAreaElement) {
    scan(preferred);
    const field = active;
    if (!field || field.disabled || field.readOnly) return false;
    return applyPromptFormat(
      field,
      kind,
      owner,
      journal,
      () => dispatch(field),
      onLimit,
    );
  }
  const unbind = bindPrompt(root, journal, history, format);
  scan();
  function clear() {
    journal.clear();
    active = null;
    retained = [];
  }
  return {
    format,
    undo: () => history(false),
    redo: () => history(true),
    beforeRender() {
      scan();
      retained = [...root.querySelectorAll<HTMLTextAreaElement>(promptSelector)].map(field => ({
        field, key: field.dataset.modePrompt, focused: owner.activeElement === field,
      }));
    },
    afterRender() {
      for (const replacement of root.querySelectorAll<HTMLTextAreaElement>(promptSelector)) {
        const previous = retained.find(item => String(getKey(replacement)) === item.key);
        if (!previous || replacement === previous.field || replacement.value !== previous.field.value) continue;
        const { selectionStart: start, selectionEnd: end, selectionDirection: direction, scrollTop: scroll } = previous.field;
        replacement.replaceWith(previous.field);
        if (previous.focused) previous.field.focus({ preventScroll: true });
        previous.field.setSelectionRange(start, end, direction);
        previous.field.scrollTop = scroll;
      }
      retained = [];
      scan();
    },
    value: (key: string) => journal.value(String(key)),
    forget(key: string) {
      journal.forget(String(key));
      journal.forget(`system:${key}`);
    },
    clear,
    dispose() {
      disposed = true;
      unbind();
      clear();
    },
  };
}
