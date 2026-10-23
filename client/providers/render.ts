import type { ProviderState, ProviderKind, PersonalProviderState } from "./contracts";
import { providerCatalogs } from "./contracts";
import { escapeHtml as escape } from "../design/html";
function providerCard(
  state: PersonalProviderState,
  kind: ProviderKind,
  title: string,
  description: string,
) {
  const value = state[kind],
    local = ["ollama", "compatible"].includes(value.provider);
  const status = value.keyConfigured
    ? value.keySource === "environment"
      ? "Chave do ambiente"
      : "Chave salva"
    : local
      ? "Servidor local"
      : "Sem chave";
  return `<section class="provider-card" data-provider-card="${kind}">
  <div class="provider-card-heading"><div><h3>${title}</h3><p>${description}</p></div><span class="connection-status ${value.keyConfigured || local ? "connected" : ""}">${status}</span></div>
  <label>Provedor<select name="${kind}.provider">${providerCatalogs[kind].map((key) => `<option value="${key}" ${value.provider === key ? "selected" : ""}>${escape(state.presets[key]?.label ?? key)}</option>`).join("")}</select></label>
  <label>Endereço da API<input name="${kind}.baseUrl" type="url" required maxlength="500" value="${escape(value.baseUrl)}" autocomplete="off"></label>
  <label>Chave da API<input name="${kind}.apiKey" type="password" maxlength="1000" placeholder="${value.keyConfigured ? "Deixe vazio para manter a chave atual" : "Cole a chave deste provedor"}" autocomplete="new-password"></label>
  ${value.keySource === "saved" ? `<label class="provider-check"><input type="checkbox" name="${kind}.clearKey">Apagar a chave salva</label>` : ""}
  <div class="provider-model-row"><label>Modelo<input name="${kind}.model" required maxlength="160" list="provider-models-${kind}" value="${escape(value.model)}" placeholder="Nome do modelo na sua conta"><datalist id="provider-models-${kind}"></datalist></label><button type="button" class="btn" data-provider-models="${kind}">Listar modelos</button></div>
  ${kind === "response" ? `<div class="provider-options"><label class="provider-check"><input name="response.vision" type="checkbox" ${value.vision ? "checked" : ""}>O modelo aceita imagens</label><label>Limite de saída<input name="response.maxTokens" type="number" min="128" max="16000" value="${value.maxTokens}"></label></div>` : `<label data-realtime-field ${value.provider !== "openai" ? "hidden" : ""}>Modelo de transcrição ao vivo<input name="transcription.realtimeModel" maxlength="160" value="${escape(value.realtimeModel)}"></label><p class="provider-hint">OpenAI e Deepgram oferecem o modo ao vivo. Os outros provedores usam trechos de áudio.</p>`}
  <div class="provider-test-result" data-provider-result="${kind}" role="status"></div></section>`;
}
export function renderProviderSettings(state: ProviderState | null) {
  if (!state) return '<div class="provider-loading">Carregando conexões…</div>';
  if (state.edition === "cloud" || !state.editable)
    return `<header class="settings-heading"><h2>Assistência do Orvunia</h2><p>Os recursos de texto, visão e transcrição são gerenciados pelo serviço.</p></header>`;
  return `<header class="settings-heading"><h2>Conexões de IA</h2><p>Escolha separadamente quem transcreve e quem prepara as respostas.</p></header>${state.loadError ? `<p class="notice">${escape(state.loadError)}</p>` : ""}
  <form id="provider-form">${providerCard(state, "response", "Geração de respostas", "Seu modelo, sua chave e seu contexto.")}${providerCard(state, "transcription", "Transcrição", "Microfone e áudio da conversa.")}
  <p class="settings-footnote">As chaves ficam no servidor${state.protection === "os" ? ", protegidas pelo cofre deste sistema" : ", no diretório privado de dados"}. Elas não voltam ao navegador. Áudio, imagens e contexto serão enviados aos provedores que você escolher.</p>
  <div class="form-footer"><button class="btn primary" type="submit">Salvar conexões</button></div></form>`;
}
