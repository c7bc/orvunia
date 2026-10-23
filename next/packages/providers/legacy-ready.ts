import type { ConnectionKind } from "./domain.ts";
import type { ProviderSettings } from "./settings.ts";

export function legacyProviderReady(providers: ProviderSettings, kind: ConnectionKind) {
  return providers.legacyReady?.(kind) ?? providers.ready(kind);
}
