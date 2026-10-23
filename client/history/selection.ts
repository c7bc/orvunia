import type { Bookmark } from "./contracts";
import { textField } from "./contracts";

function selectionOf(document: Document) {
  try {
    return (
      document.getSelection?.() ??
      document.defaultView?.getSelection?.() ??
      null
    );
  } catch {
    return null;
  }
}
export function bookmark(
  document: Document,
  owners: Element[],
): Bookmark | null {
  const active = document.activeElement,
    focusedOwner = owners.find((node) => node.contains(active));
  const selection = selectionOf(document);
  const selectedOwner = owners.find(
    (node) =>
      selection?.anchorNode &&
      selection.focusNode &&
      node.contains(selection.anchorNode) &&
      node.contains(selection.focusNode),
  );
  const externalFocus =
    active && active !== document.body && active !== document.documentElement;
  if (!focusedOwner && (!selectedOwner || externalFocus)) return null;
  const owner = focusedOwner ?? selectedOwner;
  if (!owner) return null;
  const saved: Bookmark = {
    active: focusedOwner ? (active as HTMLElement) : null,
    owner,
    selection:
      selectedOwner &&
      (!externalFocus || focusedOwner) &&
      selection?.anchorNode &&
      selection.focusNode
        ? {
            owner: selectedOwner,
            anchor: selection.anchorNode,
            anchorOffset: selection.anchorOffset,
            focus: selection.focusNode,
            focusOffset: selection.focusOffset,
          }
        : null,
    field: null,
  };
  try {
    if (focusedOwner && textField(active)) {
      saved.field = [
        active.selectionStart,
        active.selectionEnd,
        active.selectionDirection ?? "none",
      ];
      saved.selection = null;
    }
  } catch {
    /* Some input types do not expose a text selection. */
  }
  return saved;
}
function validBoundary(node: Node, offset: number) {
  return (
    node.isConnected &&
    Number.isInteger(offset) &&
    offset >= 0 &&
    offset <=
      (node.nodeType === 3
        ? (node as Text).data.length
        : node.childNodes.length)
  );
}
export function restore(
  document: Document,
  saved: Bookmark | null,
  preserved: WeakSet<Element>,
) {
  if (!saved || !preserved.has(saved.owner)) return;
  const active = document.activeElement;
  if (
    active &&
    active !== document.body &&
    active !== document.documentElement &&
    active !== saved.active
  )
    return;
  if (saved.active?.isConnected && document.activeElement !== saved.active) {
    saved.active.focus?.({ preventScroll: true });
    if (document.activeElement !== saved.active) return;
    if (saved.field && textField(saved.active))
      saved.active.setSelectionRange?.(...saved.field);
  }
  const range = saved.selection;
  if (
    !range ||
    !preserved.has(range.owner) ||
    !validBoundary(range.anchor, range.anchorOffset) ||
    !validBoundary(range.focus, range.focusOffset)
  )
    return;
  const selection = selectionOf(document);
  if (!selection) return;
  try {
    if (selection.setBaseAndExtent)
      selection.setBaseAndExtent(
        range.anchor,
        range.anchorOffset,
        range.focus,
        range.focusOffset,
      );
    else if (selection.collapse && selection.extend) {
      selection.collapse(range.anchor, range.anchorOffset);
      selection.extend(range.focus, range.focusOffset);
    }
  } catch {
    /* A removed DOM range must not prevent rendering. */
  }
}
