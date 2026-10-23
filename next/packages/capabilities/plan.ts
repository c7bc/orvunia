import type { Binding, Configuration } from "../connections/domain.ts";
import type { LocalModelComposition } from "../local-models/compose.ts";
import { CapabilityError, type Capability, type CapabilityPlan, type CapabilityTarget } from "./domain.ts";

export function resolveCapabilityPlan(configuration: Configuration, models: LocalModelComposition["service"]): CapabilityPlan {
  function resolve(binding: Binding, capability: Capability): CapabilityTarget {
    if (binding.kind === "disabled") return { kind: "disabled" };
    if (binding.kind === "shared") throw new CapabilityError("capability_binding_invalid");
    if (binding.kind === "api") {
      const connection = configuration.connections.find((item) => item.id === binding.connectionId);
      if (!connection || !connection.capabilities.includes(capability)) throw new CapabilityError("capability_unavailable");
      return { kind: "api", connectionId: connection.id, connectionRevision: connection.revision,
        provider: connection.provider, baseUrl: connection.baseUrl, model: connection.model,
        parameters: structuredClone(connection.parameters) };
    }
    const installation = models.registry.findInstallation(binding.installationId);
    if (!installation || installation.state !== "installed") throw new CapabilityError("local_model_unavailable");
    const manifest = models.catalog.find(installation.catalogId, installation.catalogRevision);
    if (!manifest.capabilities.includes(capability)) throw new CapabilityError("capability_unavailable");
    return { kind: "local", installationId: installation.id, catalogId: manifest.id, catalogRevision: manifest.revision,
      runtime: manifest.runtime, settings: { contextTokens: Math.min(manifest.maximumContext, 4096), maximumOutputTokens: 512, threads: 4 } };
  }
  const text = resolve(configuration.bindings.text, "text");
  const vision = configuration.bindings.vision.kind === "shared" ? { kind: "shared" as const, capability: "text" as const } :
    resolve(configuration.bindings.vision, "vision");
  if (vision.kind === "shared") {
    const original = configuration.bindings.text;
    if (original.kind === "api") {
      const connection = configuration.connections.find((entry) => entry.id === original.connectionId);
      if (!connection?.capabilities.includes("vision")) throw new CapabilityError("vision_unavailable");
    }
    if (original.kind === "local") {
      const installation = models.registry.findInstallation(original.installationId)!;
      if (!models.catalog.find(installation.catalogId, installation.catalogRevision).capabilities.includes("vision"))
        throw new CapabilityError("vision_unavailable");
    }
    if (original.kind === "disabled") throw new CapabilityError("vision_unavailable");
  }
  return { schemaVersion: 2, configurationRevision: configuration.revision, text, vision,
    transcription: resolve(configuration.bindings.transcription, "transcription") };
}
