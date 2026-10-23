import type { SelectRecord } from "./contracts.js";
export function optionGroup(option: HTMLOptionElement) {
  return option.parentElement?.tagName === "OPTGROUP"
    ? (option.parentElement as HTMLOptGroupElement)
    : null;
}
export function validIndexes(record: SelectRecord) {
  return [...record.select.options]
    .map((option, index) =>
      !option.disabled && !optionGroup(option)?.disabled ? index : -1,
    )
    .filter((index) => index >= 0);
}
export function synchronize(record: SelectRecord) {
  const label = record.select.selectedOptions[0]?.label ?? "";
  if (record.label.textContent !== label) record.label.textContent = label;
  if (record.button.disabled !== record.select.disabled)
    record.button.disabled = record.select.disabled;
  const accessibleLabel =
    record.select.getAttribute("aria-label") ||
    record.select.labels?.[0]?.textContent?.trim() ||
    record.select.id || "";
  if (record.button.getAttribute("aria-label") !== accessibleLabel)
    record.button.setAttribute("aria-label", accessibleLabel);
}
