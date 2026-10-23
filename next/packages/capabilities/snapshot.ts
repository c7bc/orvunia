import type { ProviderSnapshot } from "../operations/domain.ts";
import { CapabilityError, type CapabilityPlan, type CapabilityTarget } from "./domain.ts";

export function capabilityProvider(plan: CapabilityPlan, capability: "text" | "transcription"): ProviderSnapshot {
  const target: CapabilityTarget = plan[capability];
  if (target.kind === "disabled") throw new CapabilityError(`${capability}_disabled`, 422);
  return target.kind === "api" ? {
    provider: target.provider, baseUrl: target.baseUrl, model: target.model,
    vision: capability === "text" && plan.vision.kind === "shared", maxTokens: target.parameters.maxTokens ?? 2200,
  } : {
    provider: "local", baseUrl: "", model: `local:${target.catalogId}@${target.catalogRevision}`,
    vision: capability === "text" && plan.vision.kind === "shared", maxTokens: target.settings.maximumOutputTokens,
  };
}
