import type { LocalSettings } from "../../packages/config/local.ts";
import { configurationEnvironment } from "../../packages/config/environment.ts";
import type { CompositionOptions } from "./composition.ts";
import { composeLocal } from "./compose-local.ts";

export function composePersonal(settings: LocalSettings, options: CompositionOptions = {}) {
  return composeLocal(settings, {
    ...(options.clientDirectory ? { clientDirectory: options.clientDirectory } : {}),
    ...(options.clientVendorDirectory ? { clientVendorDirectory: options.clientVendorDirectory } : {}),
    ...(options.vault ? { vault: options.vault } : {}),
    ...(options.upstream ? { upstream: options.upstream } : {}),
    environment: configurationEnvironment(options.environment ?? process.env),
    transport: options.transport ?? fetch,
    log: options.log ?? (event => console.log(JSON.stringify(event))),
  });
}
