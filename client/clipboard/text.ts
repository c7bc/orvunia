export function copyText(ports: {
  native?: { copy?(text: string): Promise<unknown> } | null;
  window: Pick<Window, "navigator">;
}, text: string) {
  if (ports.native?.copy) return ports.native.copy(text);
  return ports.window.navigator.clipboard.writeText(text);
}
