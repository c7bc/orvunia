import { setTimeout as delay } from "node:timers/promises";
import type {
  TranscriptionAdapter,
  TranscriptionConnection,
} from "./domain.ts";
import { ProviderError } from "./domain.ts";
import { checked } from "./http.ts";
import type { HttpFetch } from "./http.ts";
import { providerRecord } from "./json.ts";

export function assemblyTranscription(
  connection: TranscriptionConnection,
  request: HttpFetch,
): TranscriptionAdapter {
  const base = connection.baseUrl.replace(/\/$/, ""),
    headers = { authorization: connection.apiKey ?? "" };
  return {
    async transcribe(input, signal) {
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(60_000)]);
      const uploaded = providerRecord(
        await (
          await checked(
            await request(base + "/upload", {
              method: "POST",
              headers,
              body: new Uint8Array(input.data),
              signal: deadline,
            }),
          )
        ).json(),
      );
      if (
        typeof uploaded.upload_url !== "string" ||
        new URL(uploaded.upload_url).protocol !== "https:"
      )
        throw new ProviderError("provider_unavailable");
      const job = providerRecord(
        await (
          await checked(
            await request(base + "/transcript", {
              method: "POST",
              signal: deadline,
              headers: { ...headers, "content-type": "application/json" },
              body: JSON.stringify({
                audio_url: uploaded.upload_url,
                speech_models: connection.model
                  .split(",")
                  .map((item) => item.trim()),
                ...(input.language === "auto"
                  ? { language_detection: true }
                  : { language_code: input.language }),
              }),
            }),
          )
        ).json(),
      );
      if (typeof job.id !== "string" || !/^[a-zA-Z0-9-]+$/.test(job.id))
        throw new ProviderError("provider_unavailable");
      try {
        while (true) {
          await delay(1000, undefined, { signal: deadline });
          const value = providerRecord(
            await (
              await checked(
                await request(base + "/transcript/" + job.id, {
                  headers,
                  signal: deadline,
                }),
              )
            ).json(),
          );
          if (value.status === "completed")
            return typeof value.text === "string" ? value.text.trim() : "";
          if (value.status === "error")
            throw new ProviderError("provider_unavailable");
        }
      } finally {
        await request(base + "/transcript/" + job.id, {
          method: "DELETE",
          headers,
          signal: AbortSignal.timeout(5000),
        })
          .then((response) => response.body?.cancel())
          .catch(() => {});
      }
    },
  };
}
