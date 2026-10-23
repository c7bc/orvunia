import type { PanelTranscript } from "../panel/data.js";
export type SpeechFragment = Pick<PanelTranscript, "id" | "text" | "who" | "time" | "source" | "utteranceId"> & {
  pending?: boolean;
};
export type SpeechTurn = SpeechFragment & { sourceIds: string[]; pending: boolean };
export function speechTurns(fragments: readonly SpeechFragment[], linked = false): SpeechTurn[] {
  const turns: SpeechTurn[] = [];
  let previous: SpeechFragment | undefined;
  for (const fragment of fragments) {
    const last = turns.at(-1);
    const sameUtterance = fragment.utteranceId && previous?.utteranceId === fragment.utteranceId;
    if (last && previous?.who === fragment.who && (linked ||
      (previous.source === "audio" && fragment.source === "audio" && sameUtterance))) {
      last.text += " " + fragment.text.trim();
      last.pending ||= fragment.pending === true;
      if (!fragment.pending) last.sourceIds.push(fragment.id);
    } else turns.push({ ...fragment, text: fragment.text.trim(),
      sourceIds: fragment.pending ? [] : [fragment.id], pending: fragment.pending === true });
    previous = fragment;
  }
  return turns;
}
