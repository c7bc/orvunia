export function activityFrames(
  element: HTMLElement,
  document: Document,
  window: Window,
  dot: boolean,
) {
  if (dot)
    return {
      frames: [
        { opacity: 1, offset: 0 },
        { opacity: 1, offset: 0.425 },
        { opacity: 0, offset: 0.5 },
        { opacity: 0, offset: 0.925 },
        { opacity: 1, offset: 1 },
      ],
      timing: { duration: 1000, iterations: Infinity, easing: "linear" },
    };
  const meter = document.createElement("span");
  meter.className = "transcript-sheen-measure";
  meter.setAttribute("aria-hidden", "true");
  meter.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;width:4ch;height:0;font:inherit;";
  element.append(meter);
  const characterWidth = meter.getBoundingClientRect().width;
  meter.remove();
  const width = Math.max(1, element.getBoundingClientRect().width);
  const font = parseFloat(window.getComputedStyle(element).fontSize) || 14;
  const spread = 80 + (characterWidth > 0 ? characterWidth : font * 2);
  const band = spread + 200 * Math.tan(Math.PI / 12);
  const duration = ((200 + band) / 200) * 1000 + 100;
  element.style.setProperty("--transcript-spread", spread + "px");
  element.style.setProperty("--transcript-track", width * 2 + band + 20 + "px");
  return {
    frames: [
      { backgroundPositionX: -(width + band + 20) + "px", offset: 0 },
      { backgroundPositionX: "0px", offset: 1 },
    ],
    timing: { duration, iterations: Infinity, easing: "linear" },
  };
}
