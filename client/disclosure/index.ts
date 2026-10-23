import { componentBrowser, reducedMotion } from "../components/browser.js";
import type { ComponentRoot, MotionOptions } from "../components/browser.js";
import type { Disclosure } from "./contracts.js";
import {
  cancelDisclosure,
  settleDisclosure,
  disclosureTransition,
} from "./transition.js";
export function installPanelDisclosures(
  root: ComponentRoot = document,
  options: MotionOptions = {},
) {
  const browser = componentBrowser(root);
  if (!browser) return () => {};
  const { document, window } = browser;
  const selector =
    options.selector ??
    ".calendar-local-options,.language-code-options,.calendar-admin,.model-details,.mode-system-options";
  const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const reduced = () => reducedMotion(window, options, media);
  const change = disclosureTransition(document, window, reduced);
  const records = new Map<HTMLDetailsElement, Disclosure>();
  let queued = false,
    disposed = false;
  function refresh() {
    queued = false;
    if (disposed) return;
    for (const [details, record] of records)
      if (!root.contains(details)) {
        cancelDisclosure(record);
        records.delete(details);
      }
    for (const details of root.querySelectorAll<HTMLDetailsElement>(selector)) {
      if (
        details.tagName !== "DETAILS" ||
        records.has(details) ||
        details.closest("[data-motion-exit]")
      )
        continue;
      const summary = details.querySelector<HTMLElement>(":scope > summary");
      if (!summary) continue;
      const body = document.createElement("div");
      const inner = document.createElement("div");
      body.className = "flow-disclosure-content";
      inner.className = "flow-disclosure-inner";
      for (const node of [...details.childNodes])
        if (node !== summary) inner.append(node);
      body.append(inner);
      details.append(body);
      details.classList.add("flow-disclosure");
      const record: Disclosure = {
        details,
        summary,
        body,
        inner,
        target: details.open,
        animation: null,
        click(event) {
          if (
            event.defaultPrevented ||
            (event.button !== undefined && event.button !== 0)
          )
            return;
          event.preventDefault();
          change(record, !record.target);
        },
        toggle() {
          if (!record.animation || !details.open)
            settleDisclosure(record, details.open);
        },
      };
      summary.addEventListener("click", record.click);
      details.addEventListener("toggle", record.toggle);
      records.set(details, record);
      settleDisclosure(record, details.open);
    }
  }
  const observer = new window.MutationObserver(() => {
    if (!queued && !disposed) {
      queued = true;
      queueMicrotask(refresh);
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  const onReduced = () => {
    if (reduced())
      for (const record of records.values())
        settleDisclosure(record, record.target);
  };
  media?.addEventListener?.("change", onReduced);
  refresh();
  return () => {
    disposed = true;
    observer.disconnect();
    media?.removeEventListener?.("change", onReduced);
    for (const record of records.values()) {
      settleDisclosure(record, record.target);
      record.summary.removeEventListener("click", record.click);
      record.details.removeEventListener("toggle", record.toggle);
      record.summary.removeAttribute("aria-expanded");
      record.details.removeAttribute("data-disclosure-open");
      record.details.classList.remove("flow-disclosure");
      record.body.replaceWith(...record.inner.childNodes);
    }
    records.clear();
  };
}
