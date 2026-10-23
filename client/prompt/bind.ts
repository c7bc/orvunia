import { promptSelector, selection } from "./contracts.js";
import type { PromptRoot } from "./contracts.js";
import type { PromptJournal } from "./journal.js";
function field(event: Event) {
  const target = event.target as HTMLTextAreaElement | null;
  return target?.matches?.(promptSelector) ? target : null;
}
function button(event: Event) {
  return (event.target as Element | null)?.closest?.<HTMLButtonElement>(
    ".prompt-editor [data-format]",
  );
}
export function bindPrompt(
  root: PromptRoot,
  journal: PromptJournal,
  history: (redo?: boolean, target?: HTMLTextAreaElement) => boolean,
  format: (kind: string, target?: HTMLTextAreaElement) => boolean,
) {
  const listeners: (() => void)[] = [];
  function listen(type: string, listener: EventListener, capture = false) {
    root.addEventListener(type, listener, capture);
    listeners.push(() => root.removeEventListener(type, listener, capture));
  }
  listen(
    "beforeinput",
    (event) => {
      const target = field(event);
      if (!target) return;
      const input = event as InputEvent;
      if (
        input.inputType === "historyUndo" ||
        input.inputType === "historyRedo"
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        history(input.inputType === "historyRedo", target);
      } else journal.record(target).before = selection(target);
    },
    true,
  );
  listen("input", (event) => {
    const target = field(event);
    if (target) journal.remember(target, (event as InputEvent).inputType || "");
  });
  listen(
    "mousedown",
    (event) => {
      if (button(event)) event.preventDefault();
    },
    true,
  );
  listen(
    "click",
    (event) => {
      const target = button(event);
      if (!target || target.disabled) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const editor = target.closest(".prompt-editor")?.querySelector<HTMLTextAreaElement>("textarea");
      if (editor) format(target.dataset.format ?? "", editor);
    },
    true,
  );
  listen(
    "keydown",
    (event) => {
      const keyboard = event as KeyboardEvent;
      if (
        !field(event) ||
        keyboard.isComposing ||
        keyboard.altKey ||
        !(keyboard.ctrlKey || keyboard.metaKey)
      )
        return;
      const key = keyboard.key.toLowerCase();
      if (key === "z" || (key === "y" && !keyboard.shiftKey)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        history(key === "y" || keyboard.shiftKey, field(event)!);
        return;
      }
      if (keyboard.shiftKey || (key !== "b" && key !== "i")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      format(key === "b" ? "bold" : "italic", field(event)!);
    },
    true,
  );
  return () => listeners.forEach((remove) => remove());
}
