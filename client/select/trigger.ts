import type {
  SelectActions,
  SelectContext,
  SelectRecord,
} from "./contracts.js";
import { synchronize } from "./options.js";
import { selectKeyboard } from "./keyboard.js";
export function enhanceSelect(
  context: SelectContext,
  select: HTMLSelectElement,
  id: string,
  actions: SelectActions,
): SelectRecord {
  const wrapper = context.document.createElement("span");
  const button = context.document.createElement("button");
  const label = context.document.createElement("span");
  const chevron = context.document.createElement("span");
  wrapper.className = "flow-select";
  if (select.hasAttribute("data-selected-mode"))
    wrapper.classList.add("flow-select-start-mode");
  if (select.id === "microphone" || select.id === "system-audio-device")
    wrapper.classList.add("flow-select-microphone");
  button.type = "button";
  button.className = "flow-select-trigger";
  button.role = "combobox";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  label.className = "flow-select-label";
  label.setAttribute("data-i18n-skip", "");
  chevron.className = "flow-select-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="m3 4.5 3 3 3-3"/></svg>';
  button.append(label, chevron);
  const record: SelectRecord = {
    select,
    wrapper,
    button,
    label,
    id,
    tabindex: select.getAttribute("tabindex"),
    ariaHidden: select.getAttribute("aria-hidden"),
    buffer: "",
    bufferAt: 0,
  };
  button.setAttribute("aria-controls", id);
  select.before(wrapper);
  wrapper.append(select, button);
  select.classList.add("flow-native-select");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  synchronize(record);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (context.current?.record === record) actions.close({ focus: true });
    else actions.open(record);
  });
  button.addEventListener("keydown", selectKeyboard(context, record, actions));
  return record;
}
export function restoreSelect(record: SelectRecord) {
  record.select.classList.remove("flow-native-select");
  const attributes = [
    ["tabindex", record.tabindex],
    ["aria-hidden", record.ariaHidden],
  ] as const;
  for (const [key, value] of attributes) {
    if (value === null) record.select.removeAttribute(key);
    else record.select.setAttribute(key, value);
  }
  record.wrapper.before(record.select);
  record.wrapper.remove();
}
