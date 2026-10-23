import { normalizeTranscriptionText } from "../transcription/text.ts";

export function normalizeWhisperText(value: string): string {
  return normalizeTranscriptionText(value);
}
