import type { Editor } from "@tiptap/core";
export type RichStrings = Readonly<Record<string, string>>;
export interface RichOptions {
  label: string;
  placeholder: string;
  strings: RichStrings;
  onChange(text: string): void;
  onBlur?(): void;
  onLimit?(): void;
  sanitize?(html: string): string;
}
export interface RichElements {
  shell: HTMLDivElement;
  surface: HTMLDivElement;
  tools: HTMLDivElement;
  toggle: HTMLButtonElement;
  hint: HTMLDivElement;
}
export interface RichContext {
  field: HTMLTextAreaElement;
  elements: RichElements;
  options: RichOptions;
  editor: Editor | null;
  source: boolean;
  value: string;
  silent: boolean;
  editable: boolean;
  destroyed: boolean;
  strings: RichStrings;
}
export interface RichNotes {
  shell: HTMLDivElement;
  editor: Editor;
  field: HTMLTextAreaElement;
  setValue(value: string): void;
  setEditable(editable: boolean): void;
  translate(strings: RichStrings): void;
  focus(): void;
  destroy(): void;
}
