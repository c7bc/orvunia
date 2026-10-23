import { z } from "zod";
import type { DownloadJob } from "./domain.ts";

export const modelDownloadInput = z.object({ requestId: z.uuid(), catalogId: z.string().min(1).max(160), revision: z.string().regex(/^[a-f0-9]{40}$/) }).strict();
export const modelLoadInput = z.object({ contextTokens: z.number().int().min(0).max(32768), maximumOutputTokens: z.number().int().min(1).max(8192), threads: z.number().int().min(1).max(128) }).strict();
export const modelRemovalInput = z.object({ requestId: z.uuid(), expectedRevision: z.number().int().positive() }).strict();
export const modelImportInput = modelDownloadInput.extend({ selectionId: z.uuid() }).strict();
export const compatibilityInput = z.object({ catalogId: z.string().min(1).max(160), revision: z.string().regex(/^[a-f0-9]{40}$/),
  contextTokens: z.number().int().min(0).max(32768), enabledCapabilities: z.array(z.enum(["text", "vision", "transcription"])).min(1).max(3),
  simultaneousMemoryBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0) }).strict();

export function publicModelJob(job: DownloadJob) {
  return { id: job.id, installationId: job.installationId, catalogId: job.catalogId, catalogRevision: job.catalogRevision,
    state: job.state, bytesDone: job.bytesDone, bytesTotal: job.bytesTotal, progressRevision: job.progressRevision,
    errorCode: job.errorCode, retryable: job.retryable };
}
