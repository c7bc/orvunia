import type { ApplicationTranslate } from "./contracts.js";

export function createMicrophoneDevices(ports: {
  document: Document;
  enumerate(): Promise<MediaDeviceInfo[]>;
  selected(): string;
  escape(value: unknown): string;
  translate: ApplicationTranslate;
  observe?(refresh: (force?: boolean) => void): () => void;
}) {
  let version = 0;
  async function load() {
    const element = ports.document.querySelector<HTMLSelectElement>("#microphone");
    if (!element) return;
    const token = ++version;
    let devices: MediaDeviceInfo[];
    try {
      devices = (await ports.enumerate()).filter(device => device.kind === "audioinput" && device.deviceId);
    } catch {
      if (token === version && element.isConnected)
        hint("Não foi possível listar os microfones. Confira a permissão do aplicativo.");
      return;
    }
    if (token !== version || !element.isConnected) return;
    const selected = ports.selected() || "default";
    const options = [
      { id: "default", label: devices.find(device => device.deviceId === "default")?.label
        ? `${ports.translate("Padrão do sistema")} (${devices.find(device => device.deviceId === "default")!.label})`
        : ports.translate("Padrão do sistema"), named: Boolean(devices.find(device => device.deviceId === "default")?.label) },
      ...devices.filter(device => device.deviceId !== "default").map((device, index) => ({
        id: device.deviceId, label: device.label || ports.translate("Microfone {number}", { number: index + 1 }), named: Boolean(device.label),
      })),
    ];
    const missing = !options.some(option => option.id === selected);
    element.innerHTML = options.map(option => `<option value="${ports.escape(option.id)}" ${option.named ? "data-i18n-skip" : ""} ${option.id === selected ? "selected" : ""}>${ports.escape(option.label)}</option>`).join("") +
      (missing ? `<option value="${ports.escape(selected)}" selected disabled>${ports.escape(ports.translate("Microfone selecionado indisponível"))}</option>` : "");
    hint(missing ? "Reconecte o microfone selecionado ou escolha outro dispositivo."
      : !devices.length || devices.some(device => !device.label)
        ? "Para mostrar os nomes dos dispositivos, abra Testar microfone e inicie o teste local."
        : "Sua voz será capturada pelo microfone selecionado. O áudio do computador é uma fonte separada.");
  }
  function hint(message: string) {
    const element = ports.document.querySelector("[data-microphone-hint]");
    if (element) element.textContent = ports.translate(message);
  }
  function watch() {
    let previous: Element | null = null;
    const refresh = (force = false) => {
      const element = ports.document.querySelector("#microphone");
      if (!force && element === previous) return;
      previous = element;
      if (element) void load();
    };
    const unsubscribe = ports.observe?.(refresh);
    refresh();
    return () => { version++; unsubscribe?.(); };
  }
  return { load, watch };
}
