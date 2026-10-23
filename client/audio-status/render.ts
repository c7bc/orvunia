import { escapeHtml } from "../design/html.js";
import { phaseLabels, channelLabels, sessionAudioStatus } from "./domain.js";
import type { AudioStatusContext } from "./domain.js";

export function renderAudioStatus(context: AudioStatusContext, translate = (value: string) => value) {
  const status = sessionAudioStatus(context),
    text = (value: string) => escapeHtml(translate(value));
  const label = context.current?.state === "ended"
    ? status.saved ? "Sessão encerrada — transcrições preservadas" : "Sessão encerrada — nenhuma fala salva"
    : context.current?.state === "paused" ? "Sessão pausada — escuta interrompida" : phaseLabels[status.phase];
  return `<section class="session-audio-status" data-audio-status data-phase="${status.phase}" role="status" aria-live="polite" aria-atomic="true"><div class="audio-status-heading"><span class="audio-status-dot" aria-hidden="true"></span><span>${text(label)}</span></div><div class="audio-status-channels">${status.channels.map(channel => `<span><span>${text(channel.label)}</span>: <span>${text(channel.enabled ? channelLabels[channel.phase] : "Fora da escuta")}</span></span>`).join("")}</div><div class="audio-status-saved"><span>${text("Falas salvas")}</span>: <strong data-i18n-skip>${status.saved}</strong></div></section>`;
}

export function refreshAudioStatus(document: Document, context: AudioStatusContext, translate: (value: string) => string) {
  for (const element of document.querySelectorAll<HTMLElement>("[data-audio-status], [data-audio-compact]")) {
    const holder = document.createElement("div");
    holder.innerHTML = element.hasAttribute("data-audio-compact")
      ? renderCompactAudioStatus(context, translate) : renderAudioStatus(context, translate);
    const fresh = holder.firstElementChild;
    if (fresh && fresh.outerHTML !== element.outerHTML) element.replaceWith(fresh);
  }
}

export function renderCompactAudioStatus(context: AudioStatusContext, translate = (value: string) => value) {
  const { phase } = sessionAudioStatus(context);
  const inactive = context.current?.state !== "active";
  if (phase === "off" && !inactive)
    return `<button class="audio-status-inline audio-listen-button" data-audio-compact data-phase="off" data-action="listen" title="${escapeHtml(translate(phaseLabels.off))}"><span class="audio-status-dot" aria-hidden="true"></span><span>${escapeHtml(translate("Ouvir conversa"))}</span></button>`;
  return `<span class="audio-status-inline" data-audio-compact data-phase="${phase}" ${inactive ? "hidden" : ""} role="status" aria-live="polite" aria-atomic="true"><span class="audio-status-dot" aria-hidden="true"></span><span>${escapeHtml(translate(channelLabels[phase]))}</span></span>`;
}
