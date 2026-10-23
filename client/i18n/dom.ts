import type { LocaleSettings } from "./settings";
type Rendered = { base: string; rendered: string };
const skip =
  "[data-i18n-skip],script,style,textarea,[contenteditable=true],.markdown,.transcript-line p,.user-message,.detail-user-message,code,pre";
const skipAttributes =
  "[data-i18n-skip],script,style,[contenteditable=true],.markdown,code,pre";
export function domTranslations(
  locale: LocaleSettings,
  platform: {
    document(): Document | undefined;
    observer(callback: MutationCallback): MutationObserver;
  },
) {
  const previousText = new WeakMap<Node, Rendered>();
  const previousAttributes = new WeakMap<Element, Record<string, Rendered>>();
  function textNode(node: Node) {
    if (!node.parentElement || node.parentElement.closest(skip)) return;
    const value = node.nodeValue,
      previous = previousText.get(node);
    const base = previous?.rendered === value ? previous.base : value;
    if (!base?.trim()) return;
    const [, leading = "", content = "", trailing = ""] =
      base.match(/^(\s*)([\s\S]*?)(\s*)$/) ?? [];
    let translated = locale.t(content);
    if (
      locale.currentLocale() === "en" &&
      content === "Resumo" &&
      node.parentElement.closest(".quick-actions,.overlay-menu")
    )
      translated = "Recap";
    if (
      locale.currentLocale() === "en" &&
      content === "Transcrição" &&
      node.parentElement.closest(".provider-card,.billing-usage")
    )
      translated = "Transcription";
    const rendered = leading + translated + trailing;
    previousText.set(node, { base, rendered });
    if (rendered !== value) node.nodeValue = rendered;
  }
  function attributes(element: Element) {
    if (element.closest(skipAttributes)) return;
    const values = previousAttributes.get(element) ?? {};
    for (const name of ["aria-label", "title", "placeholder", "alt"]) {
      const value = element.getAttribute(name);
      if (value === null) continue;
      const previous = values[name];
      const base = previous?.rendered === value ? previous.base : value;
      const rendered = locale.t(base);
      values[name] = { base, rendered };
      if (value !== rendered) element.setAttribute(name, rendered);
    }
    previousAttributes.set(element, values);
  }
  function translateUI(root?: Node | null) {
    const document = platform.document();
    if (!root || !document) return;
    if (root.nodeType === 3) {
      textNode(root);
      return;
    }
    if (root.nodeType === 1) {
      const element = root as Element;
      attributes(element);
      if (element.closest(skip)) return;
    }
    const walker = document.createTreeWalker(root, 4);
    while (walker.nextNode()) textNode(walker.currentNode);
    if ([1, 9, 11].includes(root.nodeType))
      for (const element of (
        root as Element | Document | DocumentFragment
      ).querySelectorAll("[aria-label],[title],[placeholder],[alt]"))
        attributes(element);
  }
  function observeUI(root: Node) {
    translateUI(root);
    const observer = platform.observer((records) => {
      for (const record of records) {
        if (record.type === "characterData") translateUI(record.target);
        else if (record.type === "attributes" && record.target.nodeType === 1)
          attributes(record.target as Element);
        else for (const node of record.addedNodes) translateUI(node);
      }
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "title", "placeholder", "alt"],
    });
    return () => observer.disconnect();
  }
  return { translateUI, observeUI };
}
