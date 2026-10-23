import { componentBrowser, reducedMotion } from "../components/browser.js";
import type { ComponentRoot } from "../components/browser.js";
import type {
  SelectContext,
  SelectOptions,
  SelectRecord,
} from "./contracts.js";
import { selectPopup } from "./popup.js";
import { enhanceSelect, restoreSelect } from "./trigger.js";
import { synchronize } from "./options.js";
export function installPanelSelects(
  root: ComponentRoot = document,
  options: SelectOptions = {},
) {
  const browser = componentBrowser(root);
  if (!browser) return () => {};
  const { document, window } = browser;
  const selector =
    options.selector ??
    ".studio-dialog :is(.preference-control select,#microphone,#system-audio-device,[data-mode-base]),select[data-selected-mode],#schedule-form select,.overlay-mode-row select,[data-connections-v2] select,[data-cloud-preferences] select,#provider-form select";
  if (typeof selector !== "string" || !selector.trim())
    throw new TypeError("Select selector must be a nonempty string");
  root.querySelectorAll(selector);
  if (
    options.motion !== undefined &&
    !["clerk", "desktop"].includes(options.motion)
  )
    throw new TypeError("Unknown Select motion variant");
  const context: SelectContext = {
    root,
    document,
    window,
    options,
    current: null,
    exits: new Set(),
    reduced: () => reducedMotion(window, options),
  };
  const records = new Map<HTMLSelectElement, SelectRecord>();
  const actions = selectPopup(context);
  let disposed = false,
    queued = false,
    sequence = 0;
  function identifier() {
    let id: string;
    do {
      id = "flow-select-" + ++sequence;
    } while (document.querySelector(`#${id},[aria-controls="${id}"]`));
    return id;
  }
  function refresh() {
    queued = false;
    if (disposed) return;
    for (const [select, record] of records) {
      if (!root.contains(select)) {
        if (context.current?.record === record)
          actions.close({ animate: false });
        records.delete(select);
      } else {
        if (
          context.current?.record === record &&
          (select.disabled || select.closest("[data-motion-exit]"))
        )
          actions.close({ animate: false });
        synchronize(record);
      }
    }
    for (const select of root.querySelectorAll<HTMLSelectElement>(selector))
      if (
        select.tagName === "SELECT" &&
        !records.has(select) &&
        !select.closest(".flow-select") &&
        !select.closest("[data-motion-exit]") &&
        !select.multiple &&
        select.size <= 1
      )
        records.set(
          select,
          enhanceSelect(context, select, identifier(), actions),
        );
  }
  const observer = new window.MutationObserver(() => {
    if (!queued && !disposed) {
      queued = true;
      queueMicrotask(refresh);
    }
  });
  observer.observe(root, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "selected", "label", "aria-label"],
  });
  const outside = (event: Event) => {
    const target = event.target as Node | null;
    if (
      context.current &&
      !context.current.popup.contains(target) &&
      !context.current.record.wrapper.contains(target)
    ) actions.close();
  };
  const scroll = (event: Event) => {
    if (
      context.current &&
      !context.current.popup.contains(event.target as Node | null)
    ) {
      const rectangle = context.current.record.button.getBoundingClientRect();
      // A scroll queued before opening must not close an unchanged anchor.
      if (Math.abs(rectangle.top - context.current.anchor.top) > 1 ||
        Math.abs(rectangle.left - context.current.anchor.left) > 1) actions.close();
    }
  };
  const change = (event: Event) => {
    const record = records.get(event.target as HTMLSelectElement);
    if (record) {
      synchronize(record);
      if (record.select.disabled && context.current?.record === record)
        actions.close();
    }
  };
  const resize = () => actions.close();
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("change", change);
  window.addEventListener("resize", resize);
  document.addEventListener("scroll", scroll, true);
  refresh();
  return () => {
    disposed = true;
    observer.disconnect();
    actions.close({ animate: false });
    for (const popup of context.exits) popup.remove();
    context.exits.clear();
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("change", change);
    window.removeEventListener("resize", resize);
    document.removeEventListener("scroll", scroll, true);
    for (const record of records.values()) restoreSelect(record);
    records.clear();
  };
}
