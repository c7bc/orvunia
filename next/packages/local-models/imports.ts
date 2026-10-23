import { createHash, randomUUID } from "node:crypto";
import { CuratedCatalog } from "./catalog.ts";
import { LocalModelError, type DownloadJob } from "./domain.ts";
import type { ArtifactStore, ModelRegistry } from "./ports.ts";
import { NativeModelSelections } from "./selections.ts";

export class ModelImports {
  private readonly running = new Set<{ controller: AbortController; done: Promise<unknown> }>();
  private closed = false;
  constructor(private readonly catalog: CuratedCatalog, private readonly registry: ModelRegistry,
    private readonly artifacts: ArtifactStore, private readonly selections: NativeModelSelections) {}
  async import(actor: string, input: { requestId: string; selectionId: string; catalogId: string; revision: string }, signal: AbortSignal): Promise<DownloadJob> {
    if (this.closed) throw new LocalModelError("import_unavailable", 503);
    const controller = new AbortController();
    const done = this.run(actor, input, AbortSignal.any([signal, controller.signal]));
    const running = { controller, done };
    this.running.add(running);
    try { return await done; } finally { this.running.delete(running); }
  }
  async close() {
    this.closed = true;
    const running = [...this.running];
    running.forEach(item => item.controller.abort());
    await Promise.allSettled(running.map(item => item.done));
  }
  private async run(actor: string, input: { requestId: string; selectionId: string; catalogId: string; revision: string }, signal: AbortSignal): Promise<DownloadJob> {
    if (!/^[a-f0-9-]{36}$/i.test(input.requestId)) throw new LocalModelError("invalid_request_id");
    const manifest = this.catalog.find(input.catalogId, input.revision);
    if (manifest.files.length !== 1) throw new LocalModelError("import_requires_complete_bundle");
    const expected = manifest.files[0];
    if (!expected) throw new LocalModelError("model_weights_missing");
    const fingerprint = createHash("sha256").update(JSON.stringify(["import", actor, input.selectionId, manifest.id, manifest.revision])).digest("hex");
    let job = this.registry.createJob({ id: randomUUID(), installationId: randomUUID(), requestId: input.requestId,
      fingerprint, catalogId: manifest.id, catalogRevision: manifest.revision, state: "queued", bytesDone: 0,
      bytesTotal: expected.bytes, progressRevision: 1, errorCode: null, retryable: false, etags: {} },
    () => { this.catalog.acquire(manifest.id, manifest.revision); });
    if (job.state === "installed") return job;
    this.catalog.acquire(manifest.id, manifest.revision);
    if (job.state !== "queued") throw new LocalModelError("import_not_resumable", 409);
    const change = (changes: Partial<DownloadJob>) => {
      const next = { ...job, ...changes, progressRevision: job.progressRevision + 1 };
      if (!this.registry.replaceJob(next, job.progressRevision)) throw new LocalModelError("job_conflict", 409);
      job = next;
    };
    change({ state: "downloading" });
    try {
      const source = await this.selections.consume(actor, input.selectionId);
      try {
        if ((await source.stat()).size !== expected.bytes) throw new LocalModelError("artifact_size_mismatch");
        await this.artifacts.reset(job.id, expected);
        const bytes = Buffer.alloc(1024 * 1024);
        for (let offset = 0; offset < expected.bytes;) {
          signal.throwIfAborted();
          const { bytesRead } = await source.read(bytes, 0, Math.min(bytes.length, expected.bytes - offset), offset);
          if (!bytesRead) throw new LocalModelError("artifact_incomplete");
          await this.artifacts.write(job.id, expected, bytes.subarray(0, bytesRead), offset);
          offset += bytesRead;
          change({ bytesDone: offset });
        }
      } finally { await source.close(); }
      signal.throwIfAborted();
      change({ state: "verifying" });
      await this.artifacts.verifyAndCommit(job.id, expected);
      this.registry.install(job, manifest);
      return this.registry.findJob(job.id) ?? job;
    } catch (error) {
      change({ state: signal.aborted ? "cancelled" : "failed", errorCode: error instanceof LocalModelError ? error.code : "import_failed" });
      throw error;
    }
  }
}
