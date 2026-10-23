import { Elysia } from "elysia";
import type { ProviderSettings } from "../../packages/providers/settings.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import {
  connectionInput,
  responseConnection,
  transcriptionConnection,
} from "../../packages/contracts/providers.ts";
import { definedFields } from "../../packages/contracts/defined.ts";
import { modelCatalog } from "../../packages/providers/catalog.ts";
import type { HttpFetch } from "../../packages/providers/http.ts";
import { HttpError } from "../../packages/http/errors.ts";
import { localeFrom, message } from "../../packages/i18n/messages.ts";

export function providerRoutes(
  settings: ProviderSettings,
  identity: Identity,
  prefix: string,
  transport: HttpFetch,
  realtimeAvailable = false,
) {
  const publicSettings = (request: Request) => {
    const value = settings.public();
    return {
      ...value,
      realtimeSupported: realtimeAvailable && value.realtimeSupported,
      loadError: value.loadError
        ? message(
            "provider_settings_unreadable",
            localeFrom(request.headers.get("accept-language")),
          )
        : "",
    };
  };
  return new Elysia({
    name: `providers-${prefix}`,
    prefix: `${prefix}/providers`,
  })
    .onBeforeHandle(async ({ request }) => {
      if (!(await identity.resolve(request)))
        throw new HttpError("unauthorized", 401);
    })
    .get("/", ({ request }) => publicSettings(request))
    .put(
      "/",
      async ({ body, request }) => {
        await settings.save({
          response: definedFields(body.response),
          transcription: definedFields(body.transcription),
        });
        return publicSettings(request);
      },
      { body: connectionInput },
    )
    .get("/response/models", () =>
      modelCatalog(settings, "response", transport),
    )
    .get("/transcription/models", () =>
      modelCatalog(settings, "transcription", transport),
    )
    .post(
      "/response/models",
      ({ body }) =>
        modelCatalog(settings, "response", transport, definedFields(body)),
      { body: responseConnection },
    )
    .post(
      "/transcription/models",
      ({ body }) =>
        modelCatalog(settings, "transcription", transport, definedFields(body)),
      { body: transcriptionConnection },
    );
}
