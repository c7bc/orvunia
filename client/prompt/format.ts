import { formatPromptSelection } from "./selection.js";
import { selection } from "./contracts.js";
import type { PromptJournal } from "./journal.js";
export function applyPromptFormat(
  field: HTMLTextAreaElement,
  kind: string,
  document: Document,
  journal: PromptJournal,
  dispatch: () => void,
  onLimit: (maximum: number, key: string | undefined) => void,
) {
  const plan = formatPromptSelection(
    field.value,
    field.selectionStart,
    field.selectionEnd,
    kind,
    field.maxLength,
  );
  if (!plan) {
    onLimit(field.maxLength, field.dataset.modePrompt);
    return false;
  }
  const scrollTop = field.scrollTop;
  field.focus({ preventScroll: true });
  field.setSelectionRange(plan.from, plan.to);
  let input = false;
  const observed = () => {
    input = true;
  };
  field.addEventListener("input", observed);
  try {
    journal.format(() => {
      // Chromium adds native insertText to its undo stack; other engines use setRangeText.
      try {
        document.execCommand?.("insertText", false, plan.insert);
      } catch {
        /* Fallback below. */
      }
      if (field.value !== plan.value)
        field.setRangeText(plan.insert, plan.from, plan.to, "end");
      field.setSelectionRange(plan.start, plan.end);
      field.scrollTop = scrollTop;
      if (!input) dispatch();
    });
  } finally {
    field.removeEventListener("input", observed);
  }
  journal.record(field).current = selection(field);
  return true;
}
