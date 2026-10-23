import { open } from "node:fs/promises";
import type { capabilityEnvironment } from "./capability-environment.ts";

export async function installCachedModel(environment: Awaited<ReturnType<typeof capabilityEnvironment>>,
  catalogId: string, sources: { weights: string; projector?: string }) {
  const models = environment.models.service;
  const manifest = models.catalog.list().find(model => model.id === catalogId);
  if (!manifest) throw Error("Required pinned model manifest is absent");
  const stagingId = crypto.randomUUID();
  for (const file of manifest.files) {
    const source = sources[file.role];
    if (!source) throw Error("A complete verified model cache is required");
    const handle = await open(source, "r");
    try {
      if ((await handle.stat()).size !== file.bytes) throw Error("Cached model byte size differs from pinned manifest");
      await models.artifacts.reset(stagingId, file);
      const buffer = Buffer.alloc(1024 * 1024);
      for (let offset = 0; offset < file.bytes;) {
        const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, file.bytes - offset), offset);
        if (!bytesRead) throw Error("Cached model is incomplete");
        try { await models.artifacts.write(stagingId, file, buffer.subarray(0, bytesRead), offset); }
        catch (error) { throw new Error(`Cached ${file.role} write failed at byte ${offset} (${bytesRead} bytes)`, { cause: error }); }
        offset += bytesRead;
      }
      await models.artifacts.verifyAndCommit(stagingId, file);
    } finally { await handle.close(); }
  }
  const job = models.downloads.create({ requestId: crypto.randomUUID(), catalogId, revision: manifest.revision });
  const installed = await models.downloads.run(job.id);
  if (installed.state !== "installed") throw Error("Verified cached model failed installation");
  return { installed, manifest };
}
