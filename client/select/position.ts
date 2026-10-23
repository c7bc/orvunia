import type { SelectContext, SelectRecord } from "./contracts.js";
export function positionPopup(
  context: SelectContext,
  record: SelectRecord,
  popup: HTMLDivElement,
) {
  const { window } = context;
  const rectangle = record.button.getBoundingClientRect();
  const height = Math.min(
    popup.scrollHeight,
    Math.max(80, window.innerHeight - 24),
  );
  const below = window.innerHeight - rectangle.bottom - 8;
  const above = rectangle.top - 8;
  const onBottom = below >= Math.min(height, 160) || below >= above;
  popup.style.width =
    Math.min(Math.max(rectangle.width, 128), window.innerWidth - 16) + "px";
  popup.style.maxHeight =
    Math.max(64, Math.min(320, onBottom ? below : above)) + "px";
  const measured = popup.getBoundingClientRect();
  popup.dataset.side = onBottom ? "bottom" : "top";
  popup.style.top =
    (onBottom
      ? rectangle.bottom + 4
      : Math.max(8, rectangle.top - measured.height - 4)) + "px";
  popup.style.left =
    Math.max(
      8,
      Math.min(rectangle.left, window.innerWidth - measured.width - 8),
    ) + "px";
}
