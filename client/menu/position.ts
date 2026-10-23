import type { MenuContext, MenuRecord } from "./contracts.js";
export function fitMenu(context: MenuContext, record: MenuRecord) {
  const { window } = context;
  if (
    !Number.isFinite(window.innerWidth) ||
    !Number.isFinite(window.innerHeight)
  )
    return;
  record.popup.style.translate = "none";
  record.popup.style.maxHeight = Math.max(32, window.innerHeight - 16) + "px";
  const box = record.popup.getBoundingClientRect();
  const anchor = record.trigger.getBoundingClientRect();
  const x = Math.max(8, Math.min(box.x, window.innerWidth - box.width - 8));
  let y = box.y;
  if (box.bottom > window.innerHeight - 8 && anchor.top - box.height - 8 >= 8) {
    y = anchor.top - box.height - 8;
    record.side = "top";
  } else if (
    box.y < 8 &&
    anchor.bottom + box.height + 8 <= window.innerHeight - 8
  ) {
    y = anchor.bottom + 8;
    record.side = "bottom";
  }
  y = Math.max(8, Math.min(y, window.innerHeight - box.height - 8));
  record.popup.style.translate = x - box.x + "px " + (y - box.y) + "px";
}
