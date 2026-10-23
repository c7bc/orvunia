export function autosizeOverlayQuestion(
  field: HTMLTextAreaElement | null | undefined,
) {
  const window = field?.ownerDocument.defaultView;
  if (!field?.style || !window) return 0;
  const style = window.getComputedStyle(field);
  const minimum = Math.max(0, parseFloat(style.minHeight) || 32);
  const maximum = Math.max(minimum, parseFloat(style.maxHeight) || 80);
  const border =
    style.boxSizing === "border-box"
      ? (parseFloat(style.borderTopWidth) || 0) +
        (parseFloat(style.borderBottomWidth) || 0)
      : 0;
  const padding =
    style.boxSizing === "border-box"
      ? 0
      : (parseFloat(style.paddingTop) || 0) +
        (parseFloat(style.paddingBottom) || 0);
  const previousScroll = field.scrollTop;
  field.style.height = `${minimum}px`;
  const content = field.scrollHeight + border - padding;
  const height = Math.max(minimum, Math.min(maximum, content));
  field.style.height = `${height}px`;
  field.style.overflowY = content > maximum ? "auto" : "hidden";
  field.scrollTop = content > maximum ? previousScroll : 0;
  return height;
}
export function overlayPopupGeometry(
  shell: { top: number; bottom: number },
  composer: { top: number },
  gap = 6,
) {
  return {
    bottom: Math.max(0, shell.bottom - composer.top) + gap,
    maxHeight: Math.max(0, Math.min(365, composer.top - shell.top - gap - 12)),
  };
}
