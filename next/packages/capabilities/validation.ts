import type { CapabilityPlan, Capability, CapabilityTarget } from "./domain.ts";
import { CapabilityError } from "./domain.ts";
import type { ConnectionService } from "../connections/service.ts";
import type { LocalModelComposition } from "../local-models/compose.ts";
import { responseConnection, transcriptionConnection } from "./api.ts";

export async function validateCapabilities(plan: CapabilityPlan, required: readonly Capability[],
  connections: ConnectionService, models: LocalModelComposition["service"]) {
  for (const capability of required) {
    const selected = plan[capability];
    const target: CapabilityTarget = selected.kind === "shared" ? plan.text : selected;
    if (target.kind === "disabled") throw new CapabilityError(`${capability}_disabled`, 422);
    if (target.kind === "api") {
      if (capability === "transcription") await transcriptionConnection(target, connections);
      else await responseConnection(target, connections, capability === "vision");
      continue;
    }
    const installation = models.registry.findInstallation(target.installationId);
    if (!installation || installation.state !== "installed" || installation.catalogId !== target.catalogId ||
        installation.catalogRevision !== target.catalogRevision) throw new CapabilityError("local_model_unavailable", 409);
    const manifest = models.catalog.find(target.catalogId, target.catalogRevision);
    if (!manifest.capabilities.includes(capability)) throw new CapabilityError("capability_unavailable", 422);
    if (!models.lifecycle.supports(target.runtime)) throw new CapabilityError("runtime_unavailable", 503);
    for (const file of manifest.files) if (!await models.artifacts.has(file))
      throw new CapabilityError("local_model_unavailable", 409);
  }
}
