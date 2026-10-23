import type { OverlayState } from "../overlay/state.js";
import { pendingSpeech } from "../overlay/speech.js";
import { isOverlayExpanded } from "../overlay/expansion.js";
export function createChatSpeechPresentation(ports: {
  document: Document; current(): OverlayState; visible(): boolean;
}) {
  const snapshots = new WeakMap<Element, string>();
  function update(region: HTMLElement, context: OverlayState) {
    const markup = pendingSpeech(context, region.dataset.chatPosition || "all").markup;
    if (snapshots.get(region) === markup) return;
    const area = ports.document.querySelector<HTMLElement>("#answer-area");
    const following = area && area.scrollHeight - area.scrollTop - area.clientHeight < 90;
    const parsed = ports.document.createElement("div");
    parsed.innerHTML = markup;
    const previous = new Map([...region.children].map(node => [node.getAttribute("data-chat-key"), node]));
    const children = [...parsed.children].map(node => {
      const old = previous.get(node.getAttribute("data-chat-key"));
      if (!old) return node;
      for (const attribute of [...old.attributes]) if (!node.hasAttribute(attribute.name)) old.removeAttribute(attribute.name);
      for (const attribute of [...node.attributes])
        if (old.getAttribute(attribute.name) !== attribute.value) old.setAttribute(attribute.name, attribute.value);
      if (old.innerHTML !== node.innerHTML) old.innerHTML = node.innerHTML;
      return old;
    });
    let cursor = region.firstElementChild;
    for (const node of children) {
      if (node === cursor) cursor = cursor.nextElementSibling;
      else region.insertBefore(node, cursor);
    }
    const retained = new Set(children);
    for (const node of [...region.children]) if (!retained.has(node)) node.remove();
    snapshots.set(region, markup);
    if (following && area) area.scrollTop = area.scrollHeight;
  }
  return {
    refresh() {
      if (!ports.visible()) return;
      const context = ports.current(), session = context.current;
      if (!session) return;
      const regions = ports.document.querySelectorAll<HTMLElement>("[data-overlay-chat-speech]");
      for (const region of regions) {
        if (region.dataset.overlayChatSpeech !== session.id) continue;
        update(region, context);
        const expanded = isOverlayExpanded(context, Boolean(context.current && context.coding?.attempt));
        const assistant = region.closest(".assistant");
        assistant?.classList.toggle("expanded", expanded);
        assistant?.classList.toggle("compact", !expanded);
        const header = assistant?.querySelector<HTMLElement>(".chat-collapse");
        if (header) header.hidden = !expanded;
      }
    },
  };
}
