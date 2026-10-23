import type { ComponentRoot, MotionOptions } from "../components/browser.js";
export type SelectOptions = MotionOptions & {
  motion?: "clerk" | "desktop";
  popupClassName?: string;
};
export type SelectRecord = {
  select: HTMLSelectElement;
  wrapper: HTMLSpanElement;
  button: HTMLButtonElement;
  label: HTMLSpanElement;
  id: string;
  tabindex: string | null;
  ariaHidden: string | null;
  buffer: string;
  bufferAt: number;
};
export type SelectCurrent = {
  record: SelectRecord;
  popup: HTMLDivElement;
  index: number;
  anchor: { top: number; left: number };
};
export type SelectContext = {
  root: ComponentRoot;
  document: Document;
  window: Window & typeof globalThis;
  options: SelectOptions;
  current: SelectCurrent | null;
  exits: Set<HTMLDivElement>;
  reduced: () => boolean;
};
export type SelectActions = {
  close: (options?: { focus?: boolean; animate?: boolean }) => void;
  open: (record: SelectRecord) => void;
  choose: (index: number, options?: { focus?: boolean }) => void;
  highlight: (index: number) => void;
};
