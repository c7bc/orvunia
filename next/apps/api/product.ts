import { Elysia } from "elysia";
import { z } from "zod";
import type { ApiDependencies } from "./core-dependencies.ts";
import type { DocumentExtractor } from "../../packages/assets/extract.ts";
import { HttpError } from "../../packages/http/errors.ts";

export function productRoutes(
  dependencies: ApiDependencies,
  prefix: string,
  documents: DocumentExtractor,
) {
  return new Elysia({ name: `product-${prefix}`, prefix })
    .onBeforeHandle(async ({ request }) => {
      if (!(await dependencies.identity.resolve(request)))
        throw new HttpError("unauthorized", 401);
    })
    .get("/health", () => {
      if (!dependencies.providers) throw new HttpError("unavailable", 503);
      const providers = dependencies.providers.settings;
      const response = providers.effective("response"),
        audio = providers.effective("transcription");
      return {
        ok: true,
        keyConfigured:
          providers.ready("response") && providers.ready("transcription"),
        keySource:
          providers.public().protection === "managed"
            ? "managed"
            : providers.public().response.keySource,
        models: {
          response: response.model,
          transcription: audio.model,
          realtime: audio.realtimeModel,
        },
        audio: dependencies.realtimeAvailable
          ? "realtime-and-recorded-chunks"
          : "recorded-chunks",
        storage: dependencies.deployment === "cloud" ? "postgresql" : "sqlite",
        deployment: dependencies.deployment ?? "local",
        realtimeSupported: Boolean(
          dependencies.realtimeAvailable && providers.realtime(),
        ),
      };
    })
    .post(
      "/import",
      async ({ body, request }) => {
        const name =
          body.file.name.replaceAll("\\", "/").split("/").at(-1) ?? "document";
        try {
          return {
            name,
            text: await documents.extract(
              Buffer.from(await body.file.arrayBuffer()),
              name,
              request.signal,
            ),
          };
        } catch (error) {
          const code = error instanceof Error ? error.message : "";
          if (code === "document_busy") throw new HttpError("unavailable", 503);
          if (code === "document_too_large") throw new HttpError(code, 413);
          if (code === "unsupported_document") throw new HttpError(code, 415);
          if (code === "invalid_document" || code === "empty_document")
            throw new HttpError(code, 400);
          throw new HttpError("document_import", 400);
        }
      },
      { body: z.object({ file: z.file().max(5 * 1024 * 1024) }).strict() },
    );
}
