import type { PanelState } from "./state.js";
import type { PanelSession } from "./data.js";
import type { ComponentRoot } from "../components/browser.js";
export type SessionActivityState = Pick<
  PanelState,
  | "current"
  | "activeVoiceActivity"
  | "liveTranscript"
  | "meLabel"
  | "themLabel"
  | "esc"
  | "translate"
>;
export function liveSessionTranscript(
  s: SessionActivityState,
  session: PanelSession,
) {
  const active = session.state === "active";
  const voice =
    active && s.activeVoiceActivity?.sessionId === session.id
      ? s.activeVoiceActivity
      : null;
  const pending =
    active &&
    s.liveTranscript?.sessionId === session.id &&
    s.liveTranscript.status === "transcribing"
      ? s.liveTranscript
      : null;
  const time = (milliseconds: number) => {
    const n = Math.floor(
      Math.max(0, Number.isFinite(milliseconds) ? milliseconds : 0) / 1000,
    );
    return n >= 3600
      ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`
      : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  };
  const label = (role: string) =>
    role === "me"
      ? s.meLabel || s.translate?.("Eu") || "Eu"
      : s.themLabel || s.translate?.("Outra pessoa") || "Outra pessoa";
  const metadata = (role: string, timing: string) =>
    `<div><strong class="${role === "me" ? "speaker-self" : ""}" ${role === "me" ? (s.meLabel ? "data-i18n-skip" : "") : s.themLabel ? "data-i18n-skip" : ""}>${s.esc(label(role))}</strong><small>${timing}</small></div>`;
  const partial = pending
    ? `<article class="detail-transcript transcript-pending">${metadata(pending.role === "me" ? "me" : "them", s.esc(time(pending.relativeMs)))}<p role="status" class="transcript-pending-label" data-transcript-pending="${s.esc(session.id)}:${pending.role === "me" ? "me" : "them"}">Transcrevendo…</p>${pending.text ? `<p data-i18n-skip>${s.esc(pending.text)}</p>` : ""}</article>`
    : "";
  const role = voice?.them ? "them" : voice?.me ? "me" : null;
  const activity = role
    ? `<article class="detail-transcript transcript-voice">${metadata(role, "Falando agora…")}<span class="transcript-voice-dot" data-voice-activity="${s.esc(session.id)}:${role}" role="status" aria-label="Atividade de voz"></span></article>`
    : "";
  return partial + activity;
}
export function liveTranscriptSignature(
  s: SessionActivityState,
  session: PanelSession,
) {
  const active = session.state === "active",
    voice =
      active && s.activeVoiceActivity?.sessionId === session.id
        ? s.activeVoiceActivity
        : null,
    partial =
      active &&
      s.liveTranscript?.sessionId === session.id &&
      s.liveTranscript.status === "transcribing"
        ? s.liveTranscript
        : null;
  return JSON.stringify([
    voice?.them ? "them" : voice?.me ? "me" : "",
    partial
      ? [
          partial.role,
          Math.floor(
            Math.max(
              0,
              Number.isFinite(partial.relativeMs) ? partial.relativeMs : 0,
            ) / 1000,
          ),
          partial.text || "",
        ]
      : null,
    s.meLabel || "",
    s.themLabel || "",
  ]);
}
export function updateSessionActivity(
  root: ComponentRoot,
  s: SessionActivityState,
) {
  const session = s.current;
  if (!session) return false;
  const region = [
    ...root.querySelectorAll<HTMLElement>("[data-session-live-transcript]"),
  ].find((el) => el.dataset.sessionLiveTranscript === session.id);
  if (!region) return false;
  const content = liveSessionTranscript(s, session);
  const signature = liveTranscriptSignature(s, session);
  const changed = region.dataset.liveSignature !== signature;
  if (changed) region.innerHTML = content;
  region.dataset.liveSignature = signature;
  const empty = region.parentElement?.querySelector<HTMLElement>(
    "[data-transcript-empty]",
  );
  if (empty) empty.hidden = Boolean(session.transcripts.length || content);
  return changed;
}
/** Body for the existing modal host, which owns focus trapping and dismissal. */
