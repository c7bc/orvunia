import { selection } from "./contracts.js";
import type { Selection } from "./contracts.js";
type Record = {
  field: HTMLTextAreaElement;
  current: Selection;
  past: Selection[];
  future: Selection[];
  lastType: string;
  lastAt: number;
  before: Selection | null;
};
export function promptJournal(notify: (field: HTMLTextAreaElement) => void) {
  const records = new Map<string | undefined, Record>();
  let formatting = false,
    applyingHistory = false;
  function record(field: HTMLTextAreaElement) {
    let state = records.get(field.dataset.modePrompt);
    if (!state || state.field !== field) {
      state = {
        field,
        current: selection(field),
        past: [],
        future: [],
        lastType: "",
        lastAt: 0,
        before: null,
      };
      records.set(field.dataset.modePrompt, state);
    }
    return state;
  }
  function remember(field: HTMLTextAreaElement, inputType: string) {
    const state = record(field),
      next = selection(field);
    if (next.value !== state.current.value && !applyingHistory) {
      const canGroup =
        !formatting &&
        /^(insertText|deleteContentBackward|deleteContentForward|insertCompositionText)$/.test(
          inputType,
        );
      const previous =
        state.before?.value === state.current.value
          ? state.before
          : state.current;
      const contiguous =
        previous.start === state.current.start &&
        previous.end === state.current.end;
      const grouped =
        canGroup &&
        contiguous &&
        state.lastType === inputType &&
        Date.now() - state.lastAt < 650;
      if (!grouped) state.past.push(previous);
      if (state.past.length > 64) state.past.shift();
      state.future = [];
      state.lastType = canGroup ? inputType : "";
      state.lastAt = Date.now();
    }
    state.current = next;
    state.before = null;
    notify(field);
  }
  function history(
    field: HTMLTextAreaElement,
    redo: boolean,
    dispatch: () => void,
  ) {
    const state = record(field),
      source = redo ? state.future : state.past,
      target = redo ? state.past : state.future;
    const next = source.pop();
    if (!next) return false;
    target.push(selection(field));
    field.value = next.value;
    field.focus({ preventScroll: true });
    field.setSelectionRange(next.start, next.end, next.direction);
    state.current = next;
    state.before = null;
    state.lastType = "";
    applyingHistory = true;
    try {
      dispatch();
    } finally {
      applyingHistory = false;
    }
    return true;
  }
  return {
    record,
    remember,
    history,
    format(action: () => void) {
      formatting = true;
      try {
        action();
      } finally {
        formatting = false;
      }
    },
    value: (key: string) => records.get(key)?.field.value,
    forget: (key: string) => {
      records.delete(key);
    },
    clear: () => records.clear(),
  };
}
export type PromptJournal = ReturnType<typeof promptJournal>;
