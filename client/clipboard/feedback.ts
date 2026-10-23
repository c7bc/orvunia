import { icon } from "../design/icons.js";

type Descriptor = { key: string; text(): string; label: string; success: string; icon: boolean };
type Attempt = { text: string; state: "pending" | "copied" | "error" };
export function createCopyFeedback(ports: {
  copy(text: string): Promise<unknown>;
  translate(text: string): string;
  toast(text: string): void;
  schedule(callback: () => void, delay: number): unknown;
}) {
  const buttons = new Map<HTMLButtonElement, Descriptor>();
  const attempts = new Map<string, Attempt>();
  function paint(button: HTMLButtonElement, descriptor: Descriptor) {
    const attempt = attempts.get(descriptor.key);
    const state = attempt?.text === descriptor.text() ? attempt.state : undefined;
    const label = ports.translate(state === "pending" ? "Copiando…" : state === "copied" ? "Copiado."
      : state === "error" ? "Tentar novamente" : descriptor.label);
    button.disabled = state === "pending";
    button.title = label; button.setAttribute("aria-label", label);
    button.setAttribute("aria-busy", String(state === "pending"));
    button.dataset.i18nSkip = "";
    if (state) button.dataset.copyState = state; else delete button.dataset.copyState;
    if (descriptor.icon) button.innerHTML = icon(state === "copied" ? "check" : state ? "refresh" : "copy", 14);
    else button.textContent = label;
  }
  function refresh() {
    for (const [button, descriptor] of buttons) {
      if (!button.isConnected) buttons.delete(button); else paint(button, descriptor);
    }
  }
  function bind(button: HTMLButtonElement, descriptor: Descriptor) {
    const bound = buttons.has(button);
    buttons.set(button, descriptor); paint(button, descriptor);
    if (bound) return;
    button.type = "button";
    button.setAttribute("aria-live", "polite");
    button.onpointerdown = event => { event.preventDefault(); };
    button.onclick = async event => {
      event.preventDefault(); event.stopPropagation();
      const current = buttons.get(button);
      if (!current) return;
      const pending = attempts.get(current.key);
      if (pending?.state === "pending" && pending.text === current.text()) return;
      const attempt: Attempt = { text: current.text(), state: "pending" };
      attempts.set(current.key, attempt); refresh();
      try {
        await ports.copy(attempt.text);
        attempt.state = "copied"; ports.toast(current.success);
      } catch {
        attempt.state = "error"; ports.toast("Não foi possível copiar. Tente novamente.");
      }
      refresh();
      ports.schedule(() => {
        if (attempts.get(current.key) !== attempt) return;
        attempts.delete(current.key); refresh();
      }, 2000);
    };
  }
  return { bind, refresh };
}
