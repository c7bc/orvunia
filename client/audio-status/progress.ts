import type { AudioPhase } from "./domain.js";
export function updateAudioProgress(progress: Map<string, AudioPhase>, sessionId: string, kind: string, phase: AudioPhase) {
  const key = `${sessionId}:${kind}`;
  const changed = progress.get(key) !== phase;
  progress.set(key, phase);
  while (progress.size > 8) progress.delete(progress.keys().next().value!);
  return changed;
}
export function validAudioPhase(value: unknown): value is AudioPhase {
  return typeof value === "string" && ["off", "starting", "selecting", "listening", "detected", "transcribing", "saved", "error"].includes(value);
}
