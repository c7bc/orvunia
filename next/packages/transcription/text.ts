const nonSpeechMarkers: readonly string[] = [
  "[BLANK_AUDIO]", "[MUSIC]", "[MÚSICA DE FUNDO]", "[MÚSICA DE FONDO]",
];

export function normalizeTranscriptionText(value: string): string {
  const text = value.trim();
  return nonSpeechMarkers.includes(text.normalize("NFC").toUpperCase()) ? "" : text;
}
