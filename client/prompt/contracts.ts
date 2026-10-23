export type Selection = {
  value: string;
  start: number;
  end: number;
  direction: HTMLTextAreaElement["selectionDirection"];
};
export type PromptRoot = Document | HTMLElement;
export type PromptOptions = {
  getKey?(field: HTMLTextAreaElement): string;
  onChange?(value: string, key: string | undefined, field: HTMLTextAreaElement): void;
  onLimit?(maximum: number, key: string | undefined): void;
};
export const promptSelector = ".prompt-editor textarea:is(#instructions, #system-prompt)";
export const selection = (field: HTMLTextAreaElement): Selection => ({
  value: field.value,
  start: field.selectionStart,
  end: field.selectionEnd,
  direction: field.selectionDirection,
});
