import type { DownloadJob, Installation, ModelFile, ModelManifest, ModelRemoval } from "./domain.ts";

export interface ModelRegistry {
  createJob(job: DownloadJob, admitCreation?: () => void): DownloadJob;
  findJob(id: string): DownloadJob | null;
  listJobs(): DownloadJob[];
  replaceJob(job: DownloadJob, expectedRevision: number): boolean;
  install(job: DownloadJob, manifest: ModelManifest): Installation;
  findInstallation(id: string): Installation | null;
  listInstallations(): Installation[];
  markDeleting(id: string, expectedRevision: number): Installation;
  finishDeletion(id: string, success: boolean): void;
  artifactReferences(sha256: string): number;
  removableArtifacts(id: string): string[];
  beginRemoval(input: { requestId: string; installationId: string; expectedRevision: number; lease: string; now: number }): ModelRemoval;
  finishRemoval(requestId: string, lease: string, success: boolean, now: number): void;
}
export type PartialArtifact = { bytes: number };
export interface ArtifactStore {
  partial(jobId: string, file: ModelFile): Promise<PartialArtifact>;
  reset(jobId: string, file: ModelFile): Promise<void>;
  write(jobId: string, file: ModelFile, bytes: Uint8Array, offset: number): Promise<void>;
  verifyAndCommit(jobId: string, file: ModelFile): Promise<void>;
  has(file: ModelFile): Promise<boolean>;
  remove(sha256: string): Promise<void>;
  path(sha256: string): Promise<string>;
}
export type DownloadResponse = {
  status: number;
  etag: string | null;
  contentRange: string | null;
  body: ReadableStream<Uint8Array>;
};
export interface DownloadTransport {
  open(file: ModelFile, offset: number, etag: string | null, signal: AbortSignal): Promise<DownloadResponse>;
}
