import type { ProviderKind, PersonalProviderState } from "./contracts";
import { t } from "@cadence/i18n";
export function providerForm(form: HTMLFormElement) {
  const field = (name: string) => {
    const element = form.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[name="${name}"]`,
    );
    if (!element) throw Error("Campo de conexão indisponível.");
    return element;
  };
  const input = (name: string) => {
    const element = form.querySelector<HTMLInputElement>(
      `input[name="${name}"]`,
    );
    if (!element) throw Error("Campo de conexão indisponível.");
    return element;
  };
  const connection = (kind: ProviderKind) => ({
    provider: field(`${kind}.provider`).value,
    baseUrl: field(`${kind}.baseUrl`).value.trim(),
    model: field(`${kind}.model`).value.trim(),
    apiKey: field(`${kind}.apiKey`).value.trim(),
    clearKey: Boolean(
      form.querySelector<HTMLInputElement>(`input[name="${kind}.clearKey"]`)
        ?.checked,
    ),
    ...(kind === "response"
      ? {
          vision: input("response.vision").checked,
          maxTokens: Number(input("response.maxTokens").value),
        }
      : {
          realtimeModel: input("transcription.realtimeModel").value,
        }),
  });
  function change(kind: ProviderKind, provider: string, state: PersonalProviderState) {
    const preset = state.presets[provider];
    if (!preset) return;
    field(`${kind}.baseUrl`).value = preset.baseUrl;
    input(`${kind}.apiKey`).value = "";
    const badge = form.querySelector(
      `[data-provider-card="${kind}"] .connection-status`,
    );
    if (badge) {
      badge.textContent = t("Configuração não salva");
      badge.classList.remove("connected");
    }
    input(`${kind}.apiKey`).placeholder = t(
      provider === state[kind].provider
        ? "Deixe vazio para manter a chave atual"
        : "Cole a chave deste provedor",
    );
    const defaults: Record<string, string> = {
      openai: kind === "response" ? "gpt-6-luna" : "gpt-transcribe",
      groq: kind === "transcription" ? "whisper-large-v3-turbo" : "",
      deepgram: "nova-3",
      assemblyai: "universal-3-pro,universal-2",
    };
    input(`${kind}.model`).value =
      provider === state[kind].provider
        ? state[kind].model
        : (defaults[provider] ?? "");
    const realtime = form.querySelector<HTMLElement>("[data-realtime-field]");
    if (kind === "transcription" && realtime)
      realtime.hidden = provider !== "openai";
  }
  return { connection, change };
}
