import { dirname, join } from "node:path";
import type { LocalSettings } from "../config/local.ts";
import type { SecretVault } from "./domain.ts";
import { providerSettings } from "./settings.ts";
import { providerDefaults, providerEnvironmentKey } from "./defaults.ts";
import { fileVault } from "./vault.ts";
import { composeConnections } from "../connections/compose.ts";
import { legacyReplacement } from "../connections/legacy.ts";
import { legacyProjection, apiBinding } from "./legacy-projection.ts";
import type { ProviderSettings } from "./settings.ts";
import { providerPresets, canonicalEndpoint } from "./presets.ts";
import type { ConnectionDependencies } from "../connections/service.ts";

type Installations = {
  installationSupports: ConnectionDependencies["installationSupports"];
  withConfigurationMutation<T>(operation: () => Promise<T>): Promise<T>;
};

export async function personalProviders(settings: LocalSettings,
  environment: Record<string, string | undefined>, installations: Installations, vault?: SecretVault) {
  const filename = join(dirname(settings.CADENCE_SQLITE_PATH), "providers.next.json");
  const initial = providerDefaults(environment);
  const original = await installations.withConfigurationMutation(() => composeConnections({
    directory: dirname(filename), initial,
    vault: vault ?? fileVault(`${filename}.key`, "cadence.providers/v1", 128 * 1024),
    environment: { trusted: (role, provider, address) =>
      canonicalEndpoint(address) === canonicalEndpoint(providerPresets[provider as keyof typeof providerPresets].baseUrl) ||
      (provider === initial[role].provider && canonicalEndpoint(address) === canonicalEndpoint(initial[role].baseUrl)) },
    environmentKey: secret => providerEnvironmentKey(environment, secret.provider),
    installationSupports: installations.installationSupports,
  }));
  let projection = await legacyProjection(original, initial);
  let legacy: ProviderSettings;
  let publicConfiguration = await original.public();
  async function refresh() {
    projection = await legacyProjection(original, initial);
    publicConfiguration = await original.public();
    legacy = await providerSettings({ initial: projection.connections, editable: true,
      protection: vault ? "os" : "file", environmentKey: () => "" });
  }
  await refresh();
  const connections = { ...original, async save(input: unknown) {
    const result = await installations.withConfigurationMutation(() => original.save(input));
    await refresh();
    return result;
  } };
  const effective: ProviderSettings["effective"] = kind => legacy.effective(kind);
  const preview: ProviderSettings["preview"] = (kind, input) => legacy.preview(kind, input);
  function publicSettings() {
    const value = legacy.public();
    for (const role of ["response", "transcription"] as const) {
      const binding = publicConfiguration.bindings[role === "response" ? "text" : role];
      if (binding.kind !== "api") continue;
      const source = publicConfiguration.connections.find(item => item.id === binding.connectionId);
      if (source) Object.assign(value[role], { keySource: source.keySource, keyConfigured: source.keyConfigured });
    }
    return value;
  }
  return { connections, effective, preview,
    legacyReady: (kind: "response" | "transcription") => apiBinding(projection.configuration, kind) && legacy.ready(kind),
    ready: (kind: "response" | "transcription") => publicConfiguration.readiness[kind === "response" ? "text" : kind],
    realtime: () => apiBinding(projection.configuration, "transcription") && legacy.realtime(),
    public: publicSettings,
    async save(input: Parameters<ProviderSettings["save"]>[0]) {
      await connections.save(legacyReplacement(await original.configuration(), input));
      return publicSettings();
    },
  };
}
