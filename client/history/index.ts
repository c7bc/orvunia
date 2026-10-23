import type { Bookmark, HistoryRoot } from "./contracts";
import { historyDocument, lists, selector, unique } from "./lists";
import { bookmark, restore } from "./selection";

export function createHistoryDomPreserver() {
  let sources = new WeakMap<Element, string>(),
    snapshots = new WeakMap<Element, string>();
  let pending = new Map<string, Element | null>(),
    preserved = new WeakSet<Element>();
  let saved: Bookmark | null = null,
    documentBefore: Document | null = null;
  return {
    beforeRender(root: HistoryRoot = globalThis.document) {
      const owners = lists(root);
      pending = unique(owners);
      snapshots = new WeakMap(owners.map((node) => [node, node.innerHTML]));
      documentBefore = historyDocument(root);
      saved = bookmark(documentBefore, owners);
    },
    afterRender(root: HistoryRoot = globalThis.document) {
      const fresh = unique(lists(root)),
        document = historyDocument(root);
      let reused = 0,
        changed = 0;
      for (const [key, node] of fresh) {
        if (!node) continue;
        const old = pending.get(key),
          source = node.innerHTML;
        if (
          old === node &&
          sources.has(node) &&
          snapshots.get(node) === source
        ) {
          preserved.add(node);
          reused++;
          continue;
        }
        if (
          old &&
          old !== node &&
          old.ownerDocument === node.ownerDocument &&
          old.tagName === node.tagName &&
          old.namespaceURI === node.namespaceURI &&
          sources.get(old) === source
        ) {
          for (const attribute of [...old.attributes])
            if (!node.hasAttribute(attribute.name))
              old.removeAttribute(attribute.name);
          for (const attribute of [...node.attributes])
            old.setAttribute(attribute.name, attribute.value);
          node.replaceWith(old);
          preserved.add(old);
          sources.set(old, source);
          reused++;
        } else {
          sources.set(node, source);
          preserved.delete(node);
          changed++;
        }
      }
      if (document === documentBefore) restore(document, saved, preserved);
      pending.clear();
      snapshots = new WeakMap();
      saved = documentBefore = null;
      return { reused, changed };
    },
    isPreserved(node: Element | null | undefined) {
      const owner = node?.closest?.(selector);
      return Boolean(owner && preserved.has(owner));
    },
    clear() {
      sources = new WeakMap();
      snapshots = new WeakMap();
      pending.clear();
      preserved = new WeakSet();
      saved = documentBefore = null;
    },
  };
}
