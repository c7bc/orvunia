import type { PanelSession } from "../panel/data.js";
import { updateSessionActivity } from "../panel/live.js";

export type VoiceActivity = { active: boolean; at: number };
export type PartialTranscript = {
  utteranceId?: string;
  who: string;
  text: string;
  sessionId: string;
  kind: string;
  relativeMs: number;
};
export type ActivityPorts = {
  document: Document;
  current(): PanelSession | null;
  clock(): number;
  origin(): number;
  voice: ReadonlyMap<string, VoiceActivity>;
  partials: ReadonlyMap<string, PartialTranscript>;
  escape(value: unknown): string;
  translate(value: string): string;
  translateUI(root: HTMLElement | null): void;
};
export function createActivityPresentation(ports: ActivityPorts) {
  function state() {
    const sessionId = ports.current()?.id,
      now = ports.clock();
    const active = (entry: VoiceActivity | undefined) =>
      Boolean(entry?.active && now - entry.at < 450 && now >= entry.at);
    const pending = [...ports.partials.values()]
      .filter((item) => item.sessionId === sessionId)
      .at(-1);
    return {
      activeVoiceActivity: sessionId
        ? {
            sessionId,
            me: active(ports.voice.get(sessionId + ":microphone")),
            them: active(ports.voice.get(sessionId + ":system")),
            relativeMs: Math.max(0, now - ports.origin()),
          }
        : null,
      liveTranscript:
        pending && sessionId
          ? {
              sessionId,
              role: pending.who === "Eu" ? "me" : "them",
              text: pending.text,
              status: "transcribing",
              relativeMs: pending.relativeMs,
            }
          : null,
    };
  }
  return {
    state,
    refresh() {
      if (
        updateSessionActivity(ports.document, {
          current: ports.current(),
          esc: ports.escape,
          translate: ports.translate,
          ...state(),
        })
      )
        ports.translateUI(
          ports.document.querySelector<HTMLElement>(
            "[data-session-live-transcript]",
          ),
        );
    },
  };
}
