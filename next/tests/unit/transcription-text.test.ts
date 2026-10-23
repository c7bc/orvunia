import { test, expect } from "bun:test";
import { normalizeTranscriptionText } from "../../packages/transcription/text.ts";
import { normalizeWhisperText } from "../../packages/local-models/whisper-text.ts";

test("only the four isolated explicit ASR markers become empty in the shared and local boundaries", () => {
  for (const marker of ["[BLANK_AUDIO]", "[MUSIC]", "[MÚSICA DE FUNDO]", "[MÚSICA DE FONDO]"])
    for (const value of [marker, ` \n${marker.toLowerCase()}\t`, marker.normalize("NFD")]) {
      expect(normalizeTranscriptionText(value)).toBe("");
      expect(normalizeWhisperText(value)).toBe("");
    }
  expect(normalizeTranscriptionText(" \n")).toBe("");
});

test("legitimate music mentions, mixed speech, punctuation, quotations and unknown markers remain verbatim", () => {
  for (const value of ["[Música]", "[MUSICA DE FUNDO]", "[MUSIC].", '"[MUSIC]"',
    "[MUSIC]\n[MUSIC]", "[MUSIC] agora explique SQL", "O token [BLANK_AUDIO] é literal.",
    "A música de fundo está alta.", "The background music is loud.", "La música de fondo está alta.",
    "Obrigado por assistir", "[APPLAUSE]", "música de fundo"]) {
    expect(normalizeTranscriptionText(` ${value} `)).toBe(value);
    expect(normalizeWhisperText(value)).toBe(value);
  }
});
