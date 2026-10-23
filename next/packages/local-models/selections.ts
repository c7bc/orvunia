import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, type FileHandle } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { LocalModelError } from "./domain.ts";

type Grant = { actor: string; path: string; expires: number; inode: number | bigint; device: number | bigint; bytes: number };
export class NativeModelSelections {
  private readonly grants = new Map<string, Grant>();
  constructor(private readonly clock: () => number = Date.now) {}
  async grant(actor: string, filename: string): Promise<string> {
    if (!actor || !isAbsolute(filename)) throw new LocalModelError("selection_invalid");
    const file = await lstat(filename);
    if (!file.isFile() || file.isSymbolicLink() || file.nlink !== 1 || file.size < 1 || file.size > 8 * 1024 ** 3)
      throw new LocalModelError("selection_invalid");
    for (const [id, grant] of this.grants) if (grant.expires <= this.clock()) this.grants.delete(id);
    if (this.grants.size >= 8) throw new LocalModelError("selection_limit", 429);
    const id = randomUUID();
    this.grants.set(id, { actor, path: filename, expires: this.clock() + 5 * 60_000, inode: file.ino, device: file.dev, bytes: file.size });
    return id;
  }
  async consume(actor: string, id: string): Promise<FileHandle> {
    const grant = this.grants.get(id);
    if (!grant || grant.actor !== actor || grant.expires <= this.clock()) throw new LocalModelError("selection_expired", 403);
    this.grants.delete(id);
    const file = await open(grant.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.size !== grant.bytes || stat.ino !== grant.inode || stat.dev !== grant.device)
        throw new LocalModelError("selection_changed", 409);
      return file;
    } catch (error) { await file.close(); throw error; }
  }
}
