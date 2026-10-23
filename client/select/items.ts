import type {
  SelectActions,
  SelectContext,
  SelectRecord,
} from "./contracts.js";
import { optionGroup, validIndexes } from "./options.js";
export function popupItems(
  context: SelectContext,
  record: SelectRecord,
  popup: HTMLDivElement,
  actions: SelectActions,
) {
  const { document } = context;
  let previousGroup: HTMLOptGroupElement | null = null;
  [...record.select.options].forEach((option, index) => {
    const group = optionGroup(option);
    if (group && group !== previousGroup) {
      const title = document.createElement("div");
      title.className = "flow-select-group";
      title.textContent = group.label;
      popup.append(title);
    }
    previousGroup = group;
    const item = document.createElement("div");
    item.role = "option";
    item.id = record.id + "-" + index;
    item.dataset.index = String(index);
    item.setAttribute("aria-selected", String(option.selected));
    item.setAttribute(
      "aria-disabled",
      String(option.disabled || !!group?.disabled),
    );
    const label = document.createElement("span");
    label.textContent = option.label;
    label.setAttribute("data-i18n-skip", "");
    const check = document.createElement("span");
    check.className = "flow-select-check";
    check.textContent = option.selected ? "✓" : "";
    check.setAttribute("aria-hidden", "true");
    item.append(label, check);
    item.addEventListener("pointermove", () => {
      if (validIndexes(record).includes(index)) actions.highlight(index);
    });
    item.addEventListener("mousedown", (event) => event.preventDefault());
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      actions.choose(index);
    });
    popup.append(item);
  });
}
