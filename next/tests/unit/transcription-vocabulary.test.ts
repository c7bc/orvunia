import { expect, test } from "bun:test";
import { transcriptionHints } from "../../packages/transcription/vocabulary.ts";
import { providerConfiguration } from "../../packages/realtime/provider-config.ts";

test("technical conversations use only explicit profile terms, without an automatic engineering glossary", () => {
  for (const language of ["pt", "es", "en", "auto"]) {
    const hints = transcriptionHints(language, "Svelte, SQLite", true);
    expect(hints.keywords).toEqual(["Svelte", "SQLite"]);
    for (const word of ["Python", "PostgreSQL", "rollback", "outbox"])
      expect(hints.prompt).not.toContain(word);
    expect(hints.prompt.match(/Svelte/g)).toHaveLength(1);
    expect(transcriptionHints(language, "", true).keywords).toEqual([]);
    expect(hints.prompt.length).toBeLessThanOrEqual(1500);
    expect(hints.prompt).not.toContain("5432");
  }
  expect(transcriptionHints("pt", "", true).prompt).toContain("engenharia de software");
  expect(transcriptionHints("es", "", true).prompt).toContain("ingeniería de software");
});

test("nontechnical conversations do not receive an unrelated engineering dictionary", () => {
  const hints = transcriptionHints("pt", "Vendas, CRM", false);
  expect(hints.keywords).toEqual(["Vendas", "CRM"]);
  expect(hints.prompt).not.toContain("PostgreSQL");
});

test("profile vocabulary cannot introduce invalid keyword characters or unbounded entries", () => {
  const hints = transcriptionHints("pt", "SQL, SQL, <unsafe>\r\nPython, " + "x".repeat(2000), true);
  expect(hints.keywords.filter(term => term === "SQL")).toHaveLength(1);
  expect(hints.keywords.every(term => term.length <= 64 && !/[<>\r\n]/.test(term))).toBe(true);
  expect(hints.prompt.length).toBeLessThanOrEqual(1500);
});

test("only supported OpenAI models receive keywords; delay, manual commits and language stay unchanged", () => {
  for (const model of ["gpt-transcribe", "gpt-live-transcribe", "custom", "gpt-4o-transcribe"]) {
    const config = providerConfiguration({ provider: "openai", model, realtimeModel: model,
      baseUrl: "https://api.openai.com/v1", apiKey: "synthetic-only" }, "owner", "pt", "Svelte, SQLite", true);
    const input = config.update!.session.audio.input;
    const modern = ["gpt-transcribe", "gpt-live-transcribe"].includes(model);
    expect("keywords" in input.transcription).toBe(modern);
    if (modern) {
      expect("keywords" in input.transcription && input.transcription.keywords).toEqual(["Svelte", "SQLite"]);
      expect(input.transcription.prompt).not.toContain("Svelte");
      expect("languages" in input.transcription && input.transcription.languages).toEqual(["pt"]);
      expect("delay" in input.transcription ? input.transcription.delay : undefined).toBe(model === "gpt-live-transcribe" ? "medium" : undefined);
    }
    expect(input.turn_detection).toBeNull();
    expect(input.transcription.model).toBe(model);
  }
});

test("default live sessions in every supported language have no list that can leak into speech", () => {
  for (const language of ["pt", "es", "en", "auto"]) {
    const config = providerConfiguration({ provider: "openai", model: "gpt-transcribe", realtimeModel: "gpt-transcribe",
      baseUrl: "https://api.openai.com/v1", apiKey: "synthetic-only" }, "owner", language, "", true);
    const transcription = config.update!.session.audio.input.transcription;
    expect("keywords" in transcription ? transcription.keywords : undefined).toBeUndefined();
    expect(transcription.prompt).not.toContain("Vocabulary:");
    expect(transcription.prompt).not.toContain("Python");
    expect("languages" in transcription ? transcription.languages : undefined).toEqual(language === "auto" ? undefined : [language]);
  }
});
