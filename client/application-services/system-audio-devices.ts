import type { ApplicationTranslate } from "./contracts.js";
type Endpoint = { id: string; name: string };
type Devices = { supported: boolean; endpoints: Endpoint[];
  defaults: Record<"console" | "multimedia" | "communications", string | null> };
function decode(value: unknown): Devices {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Dispositivos inválidos.");
  const record = value as Record<string, unknown>;
  if (typeof record.supported !== "boolean" || !Array.isArray(record.endpoints) || record.endpoints.length > 200)
    throw Error("Dispositivos inválidos.");
  const endpoints = record.endpoints.map((item: unknown) => {
    if (!item || typeof item !== "object") throw Error("Dispositivo inválido.");
    const endpoint = item as Record<string, unknown>;
    if (typeof endpoint.id !== "string" || endpoint.id.length > 512 || !endpoint.id ||
      typeof endpoint.name !== "string" || endpoint.name.length > 512 || !endpoint.name)
      throw Error("Dispositivo inválido.");
    return { id: endpoint.id, name: endpoint.name };
  });
  const defaults = record.defaults as Record<string, unknown> | undefined;
  const role = (name: string) => {
    const id = defaults?.[name];
    if (id === null) return null;
    if (typeof id !== "string" || !endpoints.some(endpoint => endpoint.id === id))
      throw Error("Dispositivo padrão inválido.");
    return id;
  };
  return { supported: record.supported, endpoints,
    defaults: { console: role("console"), multimedia: role("multimedia"), communications: role("communications") } };
}
export function createSystemAudioDevices(ports: {
  document: Document; list?: () => Promise<unknown>; selected(): string;
  escape(value: unknown): string; translate: ApplicationTranslate;
}) {
  let version = 0;
  let previous: Element | null = null;
  function hint(text: string) {
    const target = ports.document.querySelector("[data-system-audio-hint]");
    if (target) target.textContent = ports.translate(text);
  }
  async function load() {
    const element = ports.document.querySelector<HTMLSelectElement>("#system-audio-device");
    if (!element) return;
    const token = ++version;
    let unsupported = !ports.list;
    try {
      if (!ports.list) throw Error("unsupported");
      const devices = decode(await ports.list());
      if (version !== token || !element.isConnected) return;
      unsupported = !devices.supported;
      if (unsupported) throw Error("unsupported");
      const options = (["multimedia", "communications", "console"] as const).map(role => {
        const endpoint = devices.endpoints.find(item => item.id === devices.defaults[role]);
        const label = ports.translate(role === "communications" ? "Padrão para chamadas" :
          role === "console" ? "Padrão para jogos e aplicativos" : "Padrão do sistema (mídia)");
        return { id: `default:${role}`, name: `${label} (${endpoint?.name || ports.translate("Indisponível")})` };
      });
      options.push(...devices.endpoints);
      const selected = ports.selected() || "default:multimedia";
      const missing = !options.some(item => item.id === selected);
      element.disabled = false;
      element.innerHTML = options.map(item => `<option data-i18n-skip value="${ports.escape(item.id)}" ${item.id === selected ? "selected" : ""}>${ports.escape(item.name)}</option>`).join("") +
        (missing ? `<option selected disabled value="${ports.escape(selected)}">${ports.escape(ports.translate("Saída selecionada indisponível"))}</option>` : "");
      hint(missing ? "Reconecte a saída selecionada ou escolha outro dispositivo." :
        "Selecione a saída em que você ouve a entrevista. Essa fonte é independente da captura de tela.");
    } catch {
      if (version !== token || !element.isConnected) return;
      element.disabled = true;
      element.innerHTML = `<option>${ports.escape(ports.translate(unsupported ? "Captura nativa indisponível" : "Não foi possível listar as saídas de áudio."))}</option>`;
      hint(unsupported ? "Neste ambiente, a captura de áudio do computador usa a seleção de compartilhamento do navegador." :
        "Não foi possível listar as saídas de áudio.");
    }
  }
  return { load, refresh(force = false) {
    const element = ports.document.querySelector("#system-audio-device");
    if (!force && element === previous) return;
    previous = element;
    if (element) void load();
  }, dispose() { version++; previous = null; } };
}
