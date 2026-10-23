import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { LocalModelError, type ModelFile } from "./domain.ts";
import type { ArtifactStore } from "./ports.ts";

const missing = (error: unknown) => error instanceof Error && "code" in error && error.code === "ENOENT";
export class FileArtifacts implements ArtifactStore {
  private readonly root: string;
  constructor(directory: string) { this.root = resolve(directory); }
  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const root = await lstat(this.root);
    if (!root.isDirectory() || root.isSymbolicLink() || resolve(await realpath(this.root)) !== this.root)
      throw new LocalModelError("unsafe_storage_path");
  }
  private async location(name: string): Promise<string> {
    await this.initialize();
    if (!/^[a-f0-9]{64}\.(blob|part)$/.test(name)) throw new LocalModelError("unsafe_artifact_path");
    const path = join(this.root, name);
    try {
      const stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new LocalModelError("unsafe_artifact_path");
    } catch (error) { if (!missing(error)) throw error; }
    return path;
  }
  private partialName(jobId: string, file: ModelFile): string {
    return `${createHash("sha256").update(`${jobId}:${file.role}:${file.sha256}`).digest("hex")}.part`;
  }
  async partial(jobId: string, file: ModelFile): Promise<{ bytes: number }> {
    const path = await this.location(this.partialName(jobId, file));
    try {
      const stat = await lstat(path);
      if (stat.size > file.bytes) throw new LocalModelError("artifact_size_exceeded");
      return { bytes: stat.size };
    } catch (error) { if (missing(error)) return { bytes: 0 }; throw error; }
  }
  async reset(jobId: string, file: ModelFile): Promise<void> {
    await rm(await this.location(this.partialName(jobId, file)), { force: true });
  }
  async write(jobId: string, file: ModelFile, bytes: Uint8Array, offset: number): Promise<void> {
    if (offset < 0 || offset + bytes.length > file.bytes) throw new LocalModelError("artifact_size_exceeded");
    const path = await this.location(this.partialName(jobId, file));
    const initial = await lstat(path).catch((error: unknown) => { if (!missing(error)) throw error; return null; });
    const handle = await open(path, constants.O_RDWR | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.nlink !== 1 || opened.size !== offset ||
        (initial && (initial.ino !== opened.ino || initial.dev !== opened.dev)))
        throw new LocalModelError("artifact_changed");
      let written = 0;
      while (written < bytes.length) {
        const result = await handle.write(bytes, written, bytes.length - written, offset + written);
        if (!result.bytesWritten) throw new LocalModelError("artifact_write_failed");
        written += result.bytesWritten;
      }
    } finally { await handle.close(); }
  }
  private async verify(path: string, file: ModelFile, flush = false): Promise<void> {
    const initial = await lstat(path);
    const handle = await open(path, (flush ? constants.O_RDWR : constants.O_RDONLY) | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.nlink !== 1 || opened.size !== file.bytes ||
        initial.ino !== opened.ino || initial.dev !== opened.dev) throw new LocalModelError("artifact_changed");
      const hash = createHash("sha256");
      const buffer = Buffer.alloc(1024 * 1024);
      let offset = 0;
      while (offset < file.bytes) {
        const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, file.bytes - offset), offset);
        if (!bytesRead) throw new LocalModelError("artifact_incomplete");
        hash.update(buffer.subarray(0, bytesRead));
        offset += bytesRead;
      }
      if (hash.digest("hex") !== file.sha256) throw new LocalModelError("artifact_hash_mismatch");
      if (flush) await handle.sync();
    } finally { await handle.close(); }
  }
  async verifyAndCommit(jobId: string, file: ModelFile): Promise<void> {
    const partial = await this.location(this.partialName(jobId, file));
    await this.verify(partial, file, true);
    const destination = await this.location(`${file.sha256}.blob`);
    if (await this.has(file)) { await rm(partial); return; }
    await rename(partial, destination);
    await this.verify(destination, file);
  }
  async has(file: ModelFile): Promise<boolean> {
    try { await this.verify(await this.location(`${file.sha256}.blob`), file); return true; }
    catch (error) { if (missing(error)) return false; throw error; }
  }
  async remove(sha256: string): Promise<void> {
    await rm(await this.location(`${sha256}.blob`), { force: true });
  }
  async path(sha256: string): Promise<string> {
    const path = await this.location(`${sha256}.blob`);
    await lstat(path);
    return path;
  }
}
