import { Elysia } from "elysia";
import { nativeSelectionEnvelope, nativeSelectionVerifier } from "../../packages/local-models/native-proof.ts";
import { publicModelJob } from "../../packages/local-models/contracts.ts";
import type { LocalModelComposition } from "../../packages/local-models/compose.ts";
import type { Identity } from "../../packages/identity/principal.ts";
import { HttpError, errorResponse } from "../../packages/http/errors.ts";
import { LocalModelError } from "../../packages/local-models/domain.ts";

export function nativeModelRoutes(models: LocalModelComposition["service"], identity: Identity,
  verify: ReturnType<typeof nativeSelectionVerifier>, prefix: string) {
  return new Elysia({ name: `native-models-${prefix}`, prefix })
    .onError(({ request, error }) => errorResponse(error instanceof LocalModelError && error.code === "model_retired"
      ? new HttpError("model_retired", 409) : new HttpError("forbidden", 403), request, crypto.randomUUID()))
    .post("/local-models/native-imports", async ({ request, body }) => {
      const principal = await identity.resolve(request);
      if (!principal) throw new HttpError("unauthorized", 401);
      const selection = verify(body);
      models.catalog.acquire(selection.catalogId, selection.revision);
      const actor = `${principal.workspaceId}:${selection.actor}:${selection.origin}`;
      const selectionId = await models.selections.grant(actor, selection.path);
      return publicModelJob(await models.imports.import(actor, { requestId: selection.requestId,
        catalogId: selection.catalogId, revision: selection.revision, selectionId }, request.signal));
    }, { body: nativeSelectionEnvelope });
}
