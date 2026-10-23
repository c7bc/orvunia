import type { LocalModelComposition } from "../local-models/compose.ts";
import { CapabilityError, type LocalCapability } from "./domain.ts";

export class LocalCapabilityLeases {
  private mutation = Promise.resolve();
  constructor(private readonly models: LocalModelComposition["service"]) {}
  async acquire(target: LocalCapability, signal: AbortSignal): Promise<() => Promise<void>> {
    const previous = this.mutation;
    let release: () => void = () => undefined;
    this.mutation = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      signal.throwIfAborted();
      const installation = this.models.registry.findInstallation(target.installationId);
      if (!installation || installation.state !== "installed" || installation.catalogId !== target.catalogId ||
        installation.catalogRevision !== target.catalogRevision) throw new CapabilityError("original_local_model_changed");
      const active = this.models.lifecycle.status();
      const current = active.find((entry) => entry.installationId === target.installationId);
      const matches = current && JSON.stringify(current.settings) === JSON.stringify(target.settings);
      if (current && !matches) {
        if (current.inUse) throw new CapabilityError("local_model_in_use");
        await this.models.lifecycle.unload(current.installationId);
      }
      if (!matches) {
        for (const entry of active) {
          if (entry.handle.runtime === target.runtime && entry.installationId !== target.installationId) {
            if (entry.inUse) throw new CapabilityError("local_model_in_use");
            await this.models.lifecycle.unload(entry.installationId);
          }
        }
        await this.models.lifecycle.load(target.installationId, target.settings, signal);
      }
      const relinquish = this.models.lifecycle.retain(target.installationId);
      return async () => { relinquish(); };
    } finally { release(); }
  }
}
