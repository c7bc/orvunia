import { createHash, randomUUID } from "node:crypto";
import { isAbsolute, dirname } from "node:path";
import { lstatSync, readFileSync, mkdirSync, openSync, writeFileSync, fsyncSync,
  closeSync, renameSync, unlinkSync } from "node:fs";
import { z } from "zod";

const location = z.object({ root: z.string().min(1).max(8192).refine(isAbsolute),
  scope: z.array(z.string().min(1).max(240)).min(1).max(20),
  authorization: z.object({ version: z.literal(1), id: z.uuid() }).strict().optional() }).strict();
const saved = z.object({ version: z.literal(1), locations: z.record(z.string().regex(/^[a-f0-9]{64}$/), location)
  .refine(values => Object.keys(values).length <= 64) }).strict();
export type RepositoryLocation = z.infer<typeof location>;
export type RepositoryLocations = {
  get(identity: string): RepositoryLocation | undefined;
  set(identity: string, value: RepositoryLocation): void;
  remove(identity: string): void;
};

export function nativeRepositoryLocations(filename: string, origin: () => string): RepositoryLocations {
  const key = (identity: string) => createHash("sha256").update(JSON.stringify([origin(), identity])).digest("hex");
  function read(): z.infer<typeof saved> {
    try {
      const info = lstatSync(filename);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 256 * 1024)
        throw Error("repository_locations_invalid");
      return saved.parse(JSON.parse(readFileSync(filename, "utf8")));
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
        return { version: 1, locations: {} };
      throw Error("repository_locations_invalid");
    }
  }
  function write(value: z.infer<typeof saved>) {
    const text = JSON.stringify(saved.parse(value));
    if (Buffer.byteLength(text) > 256 * 1024) throw Error("repository_locations_limit");
    mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    const temporary = `${filename}.${randomUUID()}.tmp`;
    let handle: number | undefined;
    try {
      handle = openSync(temporary, "wx", 0o600);
      writeFileSync(handle, text); fsyncSync(handle); closeSync(handle); handle = undefined;
      renameSync(temporary, filename);
    } finally {
      if (handle !== undefined) closeSync(handle);
      try { unlinkSync(temporary); }
      catch (error) {
        if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
      }
    }
  }
  return {
    get(identity) { return read().locations[key(identity)]; },
    set(identity, value) {
      const current = read(); current.locations[key(identity)] = location.parse(value); write(current);
    },
    remove(identity) {
      const current = read(); delete current.locations[key(identity)]; write(current);
    },
  };
}
