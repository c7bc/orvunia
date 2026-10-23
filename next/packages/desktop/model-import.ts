import { randomUUID } from "node:crypto";
import type { NativeContext } from "./application-types.ts";
import type { PlatformInvocation } from "./platform-types.ts";
import { modelDownloadInput } from "../local-models/contracts.ts";
import { signNativeSelection } from "../local-models/native-proof.ts";
import { CuratedCatalog } from "../local-models/catalog.ts";

export async function importNativeModel(context: NativeContext, request: PlatformInvocation, input: unknown, validate: () => void) {
  if (context.deployment !== "local" || !context.identity)
    throw Error("Local model import is unavailable in this deployment.");
  validate();
  const model = modelDownloadInput.parse(input);
  new CuratedCatalog().acquire(model.catalogId, model.revision);
  const selected = await context.electron.dialog.showOpenDialog(context.panel, {
    properties: ["openFile"], filters: [{ name: "Model", extensions: ["gguf", "bin"] }],
  });
  context.abort.signal.throwIfAborted();
  validate();
  if (selected.canceled || !selected.filePaths[0]) return { cancelled: true };
  const body = signNativeSelection({ ...model, path: selected.filePaths[0],
    actor: String(request.sender.id), origin: context.origin,
    nonce: randomUUID(), expiresAt: Date.now() + 30_000 }, context.identity.token);
  const response = await fetch(`${context.origin}/api/v1/local-models/native-imports`, {
    method: "POST", redirect: "error", signal: context.abort.signal,
    headers: { Origin: context.origin, Authorization: `Bearer ${context.identity.token}`,
      "Content-Type": "application/json", "X-Cadence-Request": "1" }, body: JSON.stringify(body),
  });
  if (!response.ok) { await response.body?.cancel(); throw Error("The selected model could not be imported."); }
  return response.json() as Promise<unknown>;
}
