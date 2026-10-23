import type { ConnectionKind, Connections } from "./domain.ts";
import type { ProviderSettings } from "./settings.ts";
import type { HttpFetch } from "./http.ts";
import { enumerateModels } from "./enumerate.ts";

export async function modelCatalog<Kind extends ConnectionKind>(settings: ProviderSettings, kind: Kind, transport: HttpFetch, input?: Connections[Kind]) {
  return enumerateModels(settings.preview(kind, input), transport);
}
