import type { HistoryRoot } from "./contracts";
export const selector = "[data-history-list][data-history-page]";
export function lists(root: HistoryRoot) {
  const found = [...(root?.querySelectorAll?.<Element>(selector) ?? [])];
  if ("matches" in root && root.matches(selector)) found.unshift(root);
  return found.filter(
    (node) => !found.some((other) => other !== node && other.contains(node)),
  );
}
export function unique(nodes: Element[]) {
  const result = new Map<string, Element | null>();
  for (const node of nodes) {
    const key = JSON.stringify([
      node.getAttribute("data-history-list"),
      node.getAttribute("data-history-page"),
    ]);
    result.set(key, result.has(key) ? null : node);
  }
  return result;
}
export function historyDocument(root: HistoryRoot): Document {
  return root.ownerDocument ?? (root as Document);
}
