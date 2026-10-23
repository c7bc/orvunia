import type { CropRegion } from "./contracts.js";
export function bindCropSelection(
  wrap: HTMLElement,
  selection: HTMLElement,
  changed: (region: CropRegion) => void,
) {
  let origin: { x: number; y: number } | null = null;
  wrap.onpointerdown = (event) => {
    const bounds = wrap.getBoundingClientRect();
    origin = {
      x: Math.max(0, event.clientX - bounds.left),
      y: Math.max(0, event.clientY - bounds.top),
    };
    wrap.setPointerCapture(event.pointerId);
  };
  wrap.onpointermove = (event) => {
    if (!origin) return;
    const bounds = wrap.getBoundingClientRect(),
      x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
    const region = {
      x: Math.min(origin.x, x),
      y: Math.min(origin.y, y),
      width: Math.abs(x - origin.x),
      height: Math.abs(y - origin.y),
    };
    changed({ ...region, displayWidth: bounds.width });
    selection.hidden = false;
    Object.assign(selection.style, {
      left: region.x + "px",
      top: region.y + "px",
      width: region.width + "px",
      height: region.height + "px",
    });
  };
  wrap.onpointerup = () => {
    origin = null;
  };
  return () => {
    wrap.onpointerdown = null;
    wrap.onpointermove = null;
    wrap.onpointerup = null;
    origin = null;
  };
}
