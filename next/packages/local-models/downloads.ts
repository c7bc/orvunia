import { createHash, randomUUID } from "node:crypto";
import { CuratedCatalog } from "./catalog.ts";
import { LocalModelError, type DownloadJob, type ModelFile } from "./domain.ts";
import type { ArtifactStore, DownloadTransport, ModelRegistry } from "./ports.ts";

export class ModelDownloads {
  private readonly running = new Map<string, { controller: AbortController; done: Promise<void> }>();
  constructor(private readonly catalog: CuratedCatalog, private readonly registry: ModelRegistry,
    private readonly artifacts: ArtifactStore, private readonly transport: DownloadTransport) {}
  create(input: { requestId: string; catalogId: string; revision: string }): DownloadJob {
    if (!/^[a-f0-9-]{36}$/i.test(input.requestId)) throw new LocalModelError("invalid_request_id");
    const manifest = this.catalog.find(input.catalogId, input.revision);
    const fingerprint = createHash("sha256").update(JSON.stringify([manifest.id, manifest.revision])).digest("hex");
    return this.registry.createJob({ id: randomUUID(), installationId: randomUUID(), requestId: input.requestId,
      fingerprint, catalogId: manifest.id, catalogRevision: manifest.revision, state: "queued", bytesDone: 0,
      bytesTotal: manifest.files.reduce((sum, file) => sum + file.bytes, 0), progressRevision: 1,
      errorCode: null, retryable: false, etags: {} }, () => { this.catalog.acquire(manifest.id, manifest.revision); });
  }
  private job(id: string): DownloadJob {
    const job = this.registry.findJob(id);
    if (!job) throw new LocalModelError("job_not_found", 404);
    return job;
  }
  private update(id: string, changes: Partial<DownloadJob>): DownloadJob {
    const current = this.job(id);
    const next = { ...current, ...changes, progressRevision: current.progressRevision + 1 };
    if (!this.registry.replaceJob(next, current.progressRevision)) throw new LocalModelError("job_conflict", 409);
    return next;
  }
  async run(id: string): Promise<DownloadJob> {
    const job = this.job(id);
    if (job.state === "installed") return job;
    if (this.running.size || !["queued", "cancelled", "failed"].includes(job.state))
      throw new LocalModelError("download_busy", 409);
    const controller = new AbortController();
    this.update(id, { state: "downloading", errorCode: null, retryable: false, bytesDone: 0 });
    let finish: () => void = () => undefined;
    const done = new Promise<void>((resolve) => { finish = resolve; });
    this.running.set(id, { controller, done });
    try {
      const manifest = this.catalog.acquire(job.catalogId, job.catalogRevision);
      let completed = 0;
      for (const file of manifest.files) {
        controller.signal.throwIfAborted();
        await this.acquire(id, file, completed, controller.signal);
        completed += file.bytes;
      }
      controller.signal.throwIfAborted();
      const verifying = this.update(id, { state: "verifying", bytesDone: completed });
      this.registry.install(verifying, manifest);
    } catch (error) {
      const cancelled = controller.signal.aborted;
      const code = error instanceof LocalModelError ? error.code : "download_failed";
      this.update(id, { state: cancelled ? "cancelled" : "failed", errorCode: cancelled ? null : code,
        retryable: cancelled || !["artifact_hash_mismatch", "unsafe_artifact_path", "download_origin_denied", "model_retired"].includes(code) });
    } finally { this.running.delete(id); finish(); }
    return this.job(id);
  }
  private async acquire(id: string, file: ModelFile, completed: number, signal: AbortSignal): Promise<void> {
    if (await this.artifacts.has(file)) {
      this.update(id, { bytesDone: completed + file.bytes });
      return;
    }
    let { bytes: offset } = await this.artifacts.partial(id, file);
    if (offset === file.bytes) { await this.artifacts.verifyAndCommit(id, file); return; }
    const etag = this.job(id).etags[file.role] ?? null;
    if (offset && (!etag || etag.startsWith("W/"))) { await this.artifacts.reset(id, file); offset = 0; }
    let response = await this.transport.open(file, offset, etag, signal);
    const expectedRange = `bytes ${offset}-${file.bytes - 1}/${file.bytes}`;
    if (offset && (response.status !== 206 || response.etag !== etag || response.contentRange !== expectedRange)) {
      await response.body.cancel();
      await this.artifacts.reset(id, file);
      offset = 0;
      response = await this.transport.open(file, 0, null, signal);
    }
    if (response.status !== (offset ? 206 : 200)) { await response.body.cancel(); throw new LocalModelError("download_range_invalid"); }
    const etags = { ...this.job(id).etags };
    if (response.etag && !response.etag.startsWith("W/")) etags[file.role] = response.etag;
    else delete etags[file.role];
    this.update(id, { etags });
    const reader = response.body.getReader();
    try {
      while (true) {
        signal.throwIfAborted();
        const result = await reader.read();
        if (result.done) break;
        await this.artifacts.write(id, file, result.value, offset);
        offset += result.value.length;
        this.update(id, { bytesDone: completed + offset });
      }
      if (offset !== file.bytes) throw new LocalModelError("artifact_incomplete");
      signal.throwIfAborted();
      await this.artifacts.verifyAndCommit(id, file);
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
  cancel(id: string): DownloadJob {
    const job = this.job(id);
    if (this.running.has(id)) { this.running.get(id)?.controller.abort(); return job; }
    if (job.state === "queued") return this.update(id, { state: "cancelled", retryable: true });
    return job;
  }
  enqueue(id: string): DownloadJob {
    const job = this.job(id);
    if (job.state === "installed") return job;
    this.catalog.acquire(job.catalogId, job.catalogRevision);
    if (job.state === "queued") return job;
    if (!["cancelled", "failed"].includes(job.state) || !job.retryable)
      throw new LocalModelError("job_conflict", 409);
    return this.update(id, { state: "queued", errorCode: null });
  }
  recoverInterrupted(): number {
    if (this.running.size) throw new LocalModelError("download_busy", 409);
    let count = 0;
    for (const job of this.registry.listJobs()) {
      if (["downloading", "verifying"].includes(job.state)) {
        this.update(job.id, { state: "failed", errorCode: "download_interrupted", retryable: true });
        count++;
      }
    }
    return count;
  }
  async close(): Promise<void> {
    const running = [...this.running.values()];
    for (const entry of running) entry.controller.abort();
    await Promise.all(running.map((entry) => entry.done));
  }
}
