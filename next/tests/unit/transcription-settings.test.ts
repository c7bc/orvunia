import { expect, test } from "bun:test";
import { providerConfiguration } from "../../packages/realtime/provider-config.ts";
const connection = { provider: "openai" as const, model: "gpt-transcribe", realtimeModel: "gpt-live-transcribe",
  baseUrl: "https://api.openai.com/v1", apiKey: "synthetic-not-real" };
test("current OpenAI transcription models send plural expected-language hints while legacy models retain their contract", () => {
  for (const model of ["gpt-live-transcribe", "gpt-transcribe", "gpt-4o-transcribe", "custom-transcriber"])
    for (const language of ["pt", "es", "en", "auto"]) {
      const config = providerConfiguration({ ...connection, realtimeModel: model }, "fixture-owner", language, "SQL, TypeScript");
      const input = config.update!.session.audio.input;
      expect(input.turn_detection).toBeNull();
      const transcription = input.transcription;
      const modern = ["gpt-live-transcribe", "gpt-transcribe"].includes(model);
      expect("languages" in transcription ? transcription.languages : undefined).toEqual(modern && language !== "auto" ? [language] : undefined);
      expect("language" in transcription ? transcription.language : undefined).toBe(!modern && language !== "auto" ? language : undefined);
      expect("delay" in transcription ? transcription.delay : undefined).toBe(model === "gpt-live-transcribe" ? "medium" : undefined);
      if (modern) {
        expect("keywords" in transcription ? transcription.keywords : undefined).toEqual(["SQL", "TypeScript"]);
        expect(transcription.prompt).not.toContain("SQL");
      } else expect(transcription.prompt).toContain("SQL, TypeScript");
      expect(config.address.searchParams.get("intent")).toBe("transcription");
    }
});
test("Deepgram endpointing stays independent of the OpenAI language-hint contract", () => {
  const config = providerConfiguration({ ...connection, provider: "deepgram", baseUrl: "https://api.deepgram.com/v1" }, "owner", "pt", "");
  expect(config.update).toBeNull(); expect(config.address.searchParams.get("language")).toBe("pt");
  expect(config.address.searchParams.get("endpointing")).toBe("300");
});
