import type { AuxiliaryInteraction, AuxiliaryPublication, AuxiliaryTransport } from "./contracts.js";
import { reconcileAuxiliaryContent } from "./reconcile.js";

export function installAuxiliaryHost(document: Document, transport: AuxiliaryTransport) {
  const window = document.defaultView!;
  const host = document.querySelector<HTMLElement>("#auxiliary-content")!;
  let revision = 0, disposed = false, kind: string | null = null;
  let documentId = "";
  const send = (value: Omit<AuxiliaryInteraction, "action" | "revision" | "documentId">) => {
    void transport.invoke({ action: "interact", documentId, revision, ...value }).catch(() => {});
  };
  const click = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof window.Element)) return;
    if (target.closest("[data-auxiliary-close]")) { event.preventDefault(); send({ type: "dismiss" }); return; }
    const element = target.closest<HTMLElement>("[data-auxiliary-id]");
    if (!element) return;
    if (target.closest("input:not([type=checkbox]):not([type=radio]),textarea,select")) return;
    event.preventDefault(); send({ type: "click", target: element.dataset.auxiliaryId! });
  };
  const input = (event: Event) => {
    const target = event.target;
    if (!(target instanceof window.HTMLElement) || !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    const field = target as HTMLInputElement;
    if (field.type === "file") return;
    send({ type: event.type as "input" | "change", target: target.dataset.auxiliaryId!,
      value: field.value, ...(typeof field.checked === "boolean" ? { checked: field.checked } : {}) });
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); send({ type: "dismiss" }); return; }
    const target = event.target;
    if (!(target instanceof window.HTMLElement) || !target.dataset.auxiliaryId) return;
    if (target.matches('[role="combobox"],[role="option"]')) {
      event.preventDefault(); send({ type: "keydown", target: target.dataset.auxiliaryId,
        key: event.key, shift: event.shiftKey, control: event.ctrlKey });
    }
  };
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.target as HTMLElement;
    if (form.dataset.auxiliaryId) send({ type: "submit", target: form.dataset.auxiliaryId });
  };
  const resize = () => {
    if (disposed) return;
    const style = window.getComputedStyle(document.body);
    const height = Math.max(60, Math.min(1600, Math.ceil(host.scrollHeight
      + (document.querySelector(".auxiliary-header")?.getBoundingClientRect().height ?? 0)
      + parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0")
      + parseFloat(style.borderTopWidth || "0") + parseFloat(style.borderBottomWidth || "0"))));
    void transport.invoke({ action: "resize", height }).catch(() => {});
  };
  const unsubscribe = transport.onEvent(value => {
    if (!value || typeof value !== "object" || disposed) return;
    if ("action" in value && value.action === "hide") { revision = 0; kind = null; host.replaceChildren(); return; }
    const next = value as AuxiliaryPublication;
    if (next.action !== "publish" || typeof next.html !== "string" || next.html.length > 262144) return;
    revision = next.revision;
    documentId = next.documentId;
    const focused = document.activeElement as HTMLInputElement | null;
    const focusedId = focused?.dataset.auxiliaryId;
    const selection = focused?.tagName === "TEXTAREA" || focused?.type === "text"
      ? [focused.selectionStart, focused.selectionEnd] as const : null;
    const scroll = [...host.querySelectorAll<HTMLElement>("[data-auxiliary-id]")]
      .filter(node => node.scrollTop).map(node => [node.dataset.auxiliaryId!, node.scrollTop] as const);
    const hostScroll = host.scrollTop;
    reconcileAuxiliaryContent(host, next.html);
    host.scrollTop = hostScroll;
    if (kind !== next.kind && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      host.animate?.([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 100 });
    kind = next.kind;
    document.documentElement.lang = next.locale;
    document.body.className = "overlay auxiliary-window " + (next.theme === "dark" ? "dark" : "");
    for (const [id, top] of scroll) host.querySelector<HTMLElement>(`[data-auxiliary-id="${id}"]`)?.scrollTo(0, top);
    const replacement = focusedId && host.querySelector<HTMLInputElement>(`[data-auxiliary-id="${focusedId}"]`);
    if (replacement) { replacement.focus(); if (selection) replacement.setSelectionRange(selection[0], selection[1]); }
    window.requestAnimationFrame(resize);
  });
  document.addEventListener("click", click, true);
  document.addEventListener("input", input, true);
  document.addEventListener("change", input, true);
  document.addEventListener("keydown", keydown, true);
  document.addEventListener("submit", submit, true);
  const observer = new window.ResizeObserver(resize); observer.observe(host);
  void transport.invoke({ action: "ready" }).catch(() => {});
  return { dispose() {
    disposed = true; observer.disconnect(); unsubscribe();
    document.removeEventListener("click", click, true); document.removeEventListener("input", input, true);
    document.removeEventListener("change", input, true); document.removeEventListener("keydown", keydown, true);
    document.removeEventListener("submit", submit, true);
  } };
}
