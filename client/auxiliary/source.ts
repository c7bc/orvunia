import type { AuxiliaryInteraction, AuxiliaryTransport } from "./contracts.js";
import { auxiliarySnapshot } from "./snapshot.js";

export function installAuxiliarySource(ports: {
  document: Document;
  window: Window;
  transport: AuxiliaryTransport;
  active(): boolean;
  locale(): string;
  changed(): void;
  failed(): void;
}) {
  const { document, window, transport } = ports;
  const documentId = window.crypto.randomUUID();
  const identifiers = new WeakMap<Element, string>();
  let sequence = 0, revision = 0, signature = "", queued = false, disposed = false;
  let targets = new Map<string, Element>(), roots: readonly Element[] = [];
  function identify(node: Element) {
    let id = identifiers.get(node);
    if (!id) { id = String(++sequence); identifiers.set(node, id); }
    targets.set(id, node); return id;
  }
  function failure() {
    document.documentElement.classList.remove("detached-surfaces");
    ports.changed(); ports.failed();
  }
  function publish() {
    queued = false;
    if (disposed) return;
    const nextTargets = new Map<string, Element>();
    const previous = targets; targets = nextTargets;
    const snapshot = ports.active() ? auxiliarySnapshot(document, identify) : { roots: [], html: "", kind: "menu" as const };
    const theme = document.body.classList.contains("dark") || document.body.classList.contains("overlay") ? "dark" : "light";
    const locale = ports.locale() === "es" ? "es" : ports.locale() === "en" ? "en" : "pt-BR";
    const next = JSON.stringify([snapshot.html, snapshot.kind, theme, locale]);
    if (next === signature) { targets = previous; return; }
    signature = next; roots = snapshot.roots;
    const value = snapshot.html ? { action: "publish", documentId, revision: ++revision,
      html: snapshot.html, kind: snapshot.kind, theme, locale } : { action: "hide" };
    void transport.invoke(value).catch(failure);
  }
  function schedule() {
    if (queued || disposed) return;
    queued = true; window.queueMicrotask(publish);
  }
  function dismiss() {
    const popup = document.querySelector('.flow-select-popup:not([aria-hidden="true"])');
    if (popup) {
      const trigger = document.querySelector<HTMLElement>(`[aria-controls="${popup.id}"]`);
      trigger?.dispatchEvent(new document.defaultView!.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return;
    }
    const close = document.querySelector<HTMLElement>('#dialogs [data-action="modal-close"]')
      ?? document.querySelector<HTMLElement>('.composer [data-action="overlay-more"]');
    close?.click();
  }
  const unsubscribe = transport.onEvent(value => {
    if (disposed || !value || typeof value !== "object") return;
    const event = value as AuxiliaryInteraction;
    if (event.action !== "interact" || event.documentId !== documentId || event.revision !== revision || !ports.active()) return;
    if (event.type === "dismiss") { dismiss(); schedule(); return; }
    const target = event.target ? targets.get(event.target) : undefined;
    if (!target?.isConnected || !roots.some(root => root.contains(target))) return;
    if (target.closest('[disabled],[inert],[aria-disabled="true"]')) return;
    if (event.type === "submit" && target instanceof document.defaultView!.HTMLFormElement) {
      target.requestSubmit(); schedule(); return;
    }
    if (event.type === "click") {
      if (target instanceof document.defaultView!.HTMLElement) target.click();
      else target.dispatchEvent(new document.defaultView!.MouseEvent("click", { bubbles: true, cancelable: true }));
    } else if (event.type === "keydown") {
      target.dispatchEvent(new document.defaultView!.KeyboardEvent("keydown", { key: event.key ?? "",
        shiftKey: event.shift ?? false, ctrlKey: event.control ?? false, bubbles: true, cancelable: true }));
    } else if (["input", "change"].includes(event.type) && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
      const field = target as HTMLInputElement;
      if (event.value !== undefined && field.type !== "file") field.value = event.value;
      if (typeof event.checked === "boolean") field.checked = event.checked;
      target.dispatchEvent(new document.defaultView!.Event(event.type, { bubbles: true }));
    }
    schedule();
  });
  const observer = new document.defaultView!.MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ["class", "open", "disabled", "aria-hidden", "aria-selected"] });
  document.documentElement.classList.add("detached-surfaces");
  ports.changed(); schedule();
  return { dispose() {
    disposed = true; observer.disconnect(); unsubscribe(); targets.clear(); roots = [];
    document.documentElement.classList.remove("detached-surfaces");
    void transport.invoke({ action: "hide" }).catch(() => {});
  } };
}
