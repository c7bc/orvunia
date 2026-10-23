export type HistoryRoot = Document | Element;
export type TextField = HTMLElement & {
  selectionStart: number | null;
  selectionEnd: number | null;
  selectionDirection: "forward" | "backward" | "none" | null;
  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: "forward" | "backward" | "none",
  ): void;
};
export type Bookmark = {
  active: HTMLElement | null;
  owner: Element;
  selection: {
    owner: Element;
    anchor: Node;
    anchorOffset: number;
    focus: Node;
    focusOffset: number;
  } | null;
  field: [number | null, number | null, "forward" | "backward" | "none"] | null;
};
export function textField(element: Element | null): element is TextField {
  return Boolean(
    element &&
    "selectionStart" in element &&
    typeof element.selectionStart === "number",
  );
}
