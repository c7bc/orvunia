import { createHash } from "node:crypto";
import type { TranscriptionConnection } from "../providers/domain.ts";
import { transcriptionHints } from "../transcription/vocabulary.ts";
export function providerConfiguration(
  connection: TranscriptionConnection & { apiKey: string },
  owner: string,
  language: string,
  tags: string,
  technical = true,
) {
  const hints = transcriptionHints(language, tags, technical);
  const deepgram = connection.provider === "deepgram";
  const address = new URL(
    connection.baseUrl.replace(/\/$/, "") +
      (deepgram ? "/listen" : "/realtime"),
  );
  address.protocol = address.protocol === "https:" ? "wss:" : "ws:";
  const model = deepgram ? connection.model : connection.realtimeModel;
  const supportsKeywords = ["gpt-live-transcribe", "gpt-transcribe"].includes(model);
  if (deepgram)
    address.search = new URLSearchParams({
      model,
      encoding: "linear16",
      sample_rate: "24000",
      channels: "1",
      interim_results: "true",
      punctuate: "true",
      endpointing: "300",
      language: language === "auto" ? "multi" : language,
    }).toString();
  else address.searchParams.set("intent", "transcription");
  const headers: Record<string, string> = deepgram
    ? { Authorization: `Token ${connection.apiKey}` }
    : {
        Authorization: `Bearer ${connection.apiKey}`,
        "OpenAI-Safety-Identifier": createHash("sha256")
          .update(owner)
          .digest("hex"),
      };
  const update = deepgram
    ? null
    : {
        type: "session.update",
        session: {
          type: "transcription",
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              turn_detection: null,
              transcription: {
                model,
                ...(supportsKeywords
                  ? {
                      ...(language !== "auto" ? { languages: [language] } : {}),
                      ...(hints.keywords.length ? { keywords: hints.keywords } : {}),
                      ...(model === "gpt-live-transcribe" ? { delay: "medium" } : {}),
                    }
                  : language !== "auto"
                    ? { language }
                    : {}),
                prompt: (supportsKeywords ? transcriptionHints(language, "", technical).prompt : hints.prompt).slice(0, 900),
              },
            },
          },
        },
      };
  return { address, headers, model, deepgram, update };
}
