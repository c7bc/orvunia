import { expect, test } from "bun:test";
import { transcription } from "../../packages/providers/audio.ts";
import type { TranscriptionConnection } from "../../packages/providers/domain.ts";
import { providerDefaults } from "../../packages/providers/defaults.ts";

const connection: TranscriptionConnection = {
  provider: "openai",
  model: "gpt-transcribe",
  realtimeModel: "gpt-live-transcribe",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "synthetic-audio-key",
};
const audio = {
  data: new Uint8Array([1, 2, 3]),
  name: "synthetic.wav",
  mime: "audio/wav",
  language: "pt",
  prompt: "x".repeat(1600),
};

test("compatible audio adapters preserve legacy singular language and bounded prompt context", async () => {
  for (const provider of ["openai", "groq", "compatible"] as const) {
    const adapter = transcription(
      { ...connection, provider, model: provider === "openai" ? "gpt-4o-mini-transcribe" : connection.model },
      async (url, options) => {
        expect(String(url)).toEndWith("/audio/transcriptions");
        const form = options?.body;
        expect(form instanceof FormData).toBe(true);
        if (!(form instanceof FormData)) throw Error("Multipart body missing");
        expect(form.get("language")).toBe("pt");
        expect(form.has("languages[]")).toBe(false);
        expect(String(form.get("prompt")).length).toBe(1500);
        expect((form.get("file") as File).name).toBe("synthetic.wav");
        return Response.json({ text: " Transcrição " });
      },
    );
    expect(await adapter.transcribe(audio, new AbortController().signal)).toBe(
      "Transcrição",
    );
  }
});

test("actual OpenAI default uses a language array for PT/ES and no hint for auto", async () => {
  for (const language of ["pt", "es", "auto"]) {
    const configured = { ...providerDefaults({}).transcription, apiKey: "synthetic-key" };
    expect(configured.model).toBe("gpt-transcribe");
    const adapter = transcription(configured, async (_url, options) => {
      const form = options?.body;
      expect(form instanceof FormData).toBe(true);
      if (!(form instanceof FormData)) throw Error("Multipart body missing");
      expect(form.get("model")).toBe("gpt-transcribe");
      expect(form.has("language")).toBe(false);
      expect(form.getAll("languages[]")).toEqual(language === "auto" ? [] : [language]);
      return Response.json({ text: "Texto sintético" });
    });
    expect(await adapter.transcribe({ ...audio, language }, new AbortController().signal)).toBe("Texto sintético");
  }
});

test("legacy full/mini/Whisper and compatible custom names keep singular hints", async () => {
  for (const provider of ["openai", "groq", "compatible"] as const)
    for (const model of ["gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-1", "gpt-transcribe-custom"])
      for (const language of ["es", "auto"]) {
        const adapter = transcription({ ...connection, provider, model }, async (_url, options) => {
          const form = options?.body;
          if (!(form instanceof FormData)) throw Error("Multipart body missing");
          expect(form.get("language")).toBe(language === "auto" ? null : language);
          expect(form.has("languages[]")).toBe(false);
          return Response.json({ text: "Texto" });
        });
        expect(await adapter.transcribe({ ...audio, language }, new AbortController().signal)).toBe("Texto");
      }
});

test("Deepgram sends the audio bytes and language detection without disk retention", async () => {
  const adapter = transcription(
    { ...connection, provider: "deepgram" },
    async (url, options) => {
      expect(new URL(String(url)).searchParams.get("detect_language")).toBe(
        "true",
      );
      expect(new Headers(options?.headers).get("Authorization")).toBe(
        "Token synthetic-audio-key",
      );
      expect(options?.body).toEqual(audio.data);
      return Response.json({
        results: { channels: [{ alternatives: [{ transcript: "Speech" }] }] },
      });
    },
  );
  expect(
    await adapter.transcribe(
      { ...audio, language: "auto" },
      new AbortController().signal,
    ),
  ).toBe("Speech");
});

test("AssemblyAI polls its own job and attempts remote deletion after completion", async () => {
  const calls: string[] = [];
  const adapter = transcription(
    { ...connection, provider: "assemblyai" },
    async (url, options) => {
      const path = new URL(String(url)).pathname;
      calls.push(`${options?.method ?? "GET"} ${path}`);
      if (path.endsWith("/upload"))
        return Response.json({
          upload_url: "https://uploads.example.test/synthetic",
        });
      if (path.endsWith("/transcript"))
        return Response.json({ id: "synthetic-job" });
      if (options?.method === "DELETE")
        return new Response(null, { status: 204 });
      return Response.json({ status: "completed", text: "Finished speech" });
    },
  );
  expect(await adapter.transcribe(audio, new AbortController().signal)).toBe(
    "Finished speech",
  );
  expect(calls.at(-1)).toEndWith("DELETE /v1/transcript/synthetic-job");
});
