import { object, list, string, capabilities } from "../connections/domain.js";
import type { Capability } from "../connections/domain.js";
import type { CatalogModel, Installation, ModelJob } from "./domain.js";
const number = (value: unknown) => { if (typeof value !== "number" || !Number.isFinite(value)) throw Error("Resposta inválida do servidor."); return value; };
function availability(model: Record<string, unknown>): Pick<CatalogModel, "availability"> {
  if (!Object.hasOwn(model, "availability")) return {};
  if (model.availability !== "retired") throw Error("Resposta inválida do servidor.");
  return { availability: "retired" };
}
export function catalogModels(value: unknown): CatalogModel[] {
  return list(object(value).models).map((entry) => {
    const model = object(entry);
    return { id: string(model.id), revision: string(model.revision), name: string(model.name),
      ...availability(model),
      source: string(model.source), evaluation: string(model.evaluation), maximumContext: number(model.maximumContext),
      ...(model.format == null ? {} : { format: string(model.format) }),
      ...(model.quantization == null ? {} : { quantization: string(model.quantization) }),
      ...(model.license == null ? {} : { license: { name: string(object(model.license).name), url: string(object(model.license).url) } }),
      capabilities: list(model.capabilities).map((item) => {
        if (!capabilities.includes(item as Capability)) throw Error("Capacidade inválida."); return item as Capability;
      }), files: list(model.files).map((item) => ({ bytes: number(object(item).bytes) })) };
  });
}
export function installations(value: unknown): Installation[] {
  return list(object(value).installations).map((entry) => { const item = object(entry);
    return { id: string(item.id), catalogId: string(item.catalogId), catalogRevision: string(item.catalogRevision),
      revision: number(item.revision), state: string(item.state), ...(item.removal ? { removal: {
        requestId: string(object(item.removal).requestId), expectedRevision: number(object(item.removal).expectedRevision),
      } } : {}) }; });
}
export function jobs(value: unknown): ModelJob[] {
  return list(object(value).jobs).map((entry) => { const item = object(entry);
    return { id: string(item.id), installationId: string(item.installationId), catalogId: string(item.catalogId),
      catalogRevision: string(item.catalogRevision), state: string(item.state),
      bytesDone: number(item.bytesDone), bytesTotal: number(item.bytesTotal), progressRevision: number(item.progressRevision),
      errorCode: item.errorCode === null ? null : string(item.errorCode), retryable: item.retryable === true }; });
}
export function hardware(value: unknown) {
  const item = object(value);
  return { processors: number(item.processors), totalMemoryBytes: number(item.totalMemoryBytes),
    freeDiskBytes: item.freeDiskBytes === null ? null : number(item.freeDiskBytes) };
}
export function runtimes(value: unknown) {
  return list(object(value).runtimes).map((entry) => {
    const item = object(entry); return { installationId: string(item.installationId), healthy: item.healthy === true };
  });
}
