import type { PanelState } from "../panel/state.js";
import type { DisplayPage, PanelTranscript } from "../panel/data.js";
import type { PartialTranscript } from "./activity.js";
import { utteranceFields } from "../audio/utterance.js";

export type TranscriptPorts = {
  document: Document;
  tab(): string;
  currentId(): string | undefined;
  partials: Map<string, PartialTranscript>;
  page(): DisplayPage<PanelTranscript>;
  total(): number;
  panel(): PanelState;
  navigation(
    state: PanelState,
    page: DisplayPage<PanelTranscript>,
    kind: "transcripts",
    view: string,
  ): string;
  escape(value: unknown): string;
  icon(name: string, size: number): string;
  broadcast(value: {
    type: "partial-transcript";
    sessionId: string;
    kind: string;
    item: string;
    text: string;
    done: boolean;
    relativeMs: number;
    utteranceId?: string;
  }): void;
  refreshActivity(): void;
};
export function createTranscriptPresentation(ports: TranscriptPorts) {
  return {
    refresh() {
      if (ports.tab() !== "transcripts") return;
      const lines =
          ports.document.querySelector<HTMLElement>("#transcript-lines"),
        page = ports.page();
      if (lines && lines.dataset.historyPage !== page.key) {
        lines.innerHTML = page.items
          .map(
            (item) =>
              `<div class="transcript-line"><div class="who">${ports.icon(item.who === "Eu" ? "mic" : "volume", 12)}${ports.escape(item.who)}<small>${ports.escape(item.time)}</small></div><p>${ports.escape(item.text)}</p></div>`,
          )
          .join("");
        lines.dataset.historyPage = page.key;
      }
      if (lines) {
        const navigation = ports.navigation(
          ports.panel(),
          page,
          "transcripts",
          "overlay-transcripts",
        );
        const old = lines.previousElementSibling?.matches(".history-pagination")
          ? lines.previousElementSibling
          : null;
        if (old) old.outerHTML = navigation;
        else if (navigation)
          lines.insertAdjacentHTML("beforebegin", navigation);
      }
      const label = ports.document.querySelector<HTMLElement>(
        '[data-tab="transcripts"]',
      );
      if (label) label.textContent = `Transcrição ${ports.total()}`;
    },
    partial(
      kind: string,
      item: string,
      text: string,
      done: boolean,
      sessionId: string | undefined,
      remote: boolean,
      relativeMs: number,
      utteranceId?: string,
    ) {
      if (!sessionId) return;
      const key = sessionId + ":" + kind + ":" + item;
      if (done) ports.partials.delete(key);
      else
        ports.partials.set(key, {
          who: kind === "system" ? "Entrevistador" : "Eu",
          text: ((ports.partials.get(key)?.text || "") + text).slice(-16000),
          sessionId,
          kind,
          relativeMs,
          ...utteranceFields(utteranceId ?? ports.partials.get(key)?.utteranceId),
        });
      while (ports.partials.size > 16) {
        const oldest = ports.partials.keys().next().value;
        if (oldest !== undefined) ports.partials.delete(oldest);
      }
      if (!remote)
        ports.broadcast({
          type: "partial-transcript",
          sessionId,
          kind,
          item,
          text,
          done,
          relativeMs,
          ...utteranceFields(utteranceId),
        });
      ports.refreshActivity();
      const element = ports.document.querySelector<HTMLElement>(
        "#partial-transcripts",
      );
      if (element)
        element.innerHTML = [...ports.partials.values()]
          .filter((value) => value.sessionId === ports.currentId())
          .map(
            (item) =>
              `<div class="transcript-line" style="opacity:.65"><div class="who">${ports.escape(item.who)} · transcrevendo</div><p>${ports.escape(item.text)}</p></div>`,
          )
          .join("");
    },
  };
}
