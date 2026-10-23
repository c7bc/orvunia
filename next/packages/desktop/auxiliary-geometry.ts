import type { WindowBounds } from "./gaze-types.ts";

export function auxiliaryBounds(anchor: WindowBounds, area: WindowBounds, width: number, height: number): WindowBounds {
  const gap = 12;
  const fittedWidth = Math.min(width, area.width);
  const fittedHeight = Math.min(height, area.height);
  const right = anchor.x + anchor.width + gap;
  const left = anchor.x - fittedWidth - gap;
  const preferred = right + fittedWidth <= area.x + area.width ? right : left;
  return { x: Math.max(area.x, Math.min(preferred, area.x + area.width - fittedWidth)),
    y: Math.max(area.y, Math.min(anchor.y, area.y + area.height - fittedHeight)),
    width: fittedWidth, height: fittedHeight };
}
