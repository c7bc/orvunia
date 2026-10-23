import { mkdir, open, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { readPrivateFile } from "../providers/private-file.ts";
import { ConnectionError } from "./domain.ts";
import { missingFile } from "./atomic.ts";
function ownerIsAlive(identifier: number) {
  try { process.kill(identifier, 0); return true; }
  catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}
export function configurationLock(filename: string) {
  return async function locked<Result>(action: () => Promise<Result>): Promise<Result> {
    await mkdir(dirname(filename), { recursive: true, mode: 0o700 });
    const token = crypto.randomUUID();
    for (let attempt = 0; ; attempt++) {
      try {
        const handle = await open(filename, "wx", 0o600);
        try { await handle.writeFile(JSON.stringify({ pid: process.pid, token })); await handle.sync(); }
        finally { await handle.close(); }
        break;
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
        if (attempt >= 1) throw new ConnectionError("connection_busy", 409);
        await reclaim(filename);
      }
    }
    try { return await action(); }
    finally {
      const owner: unknown = JSON.parse((await readPrivateFile(filename, 1024)).toString("utf8"));
      if (owner && typeof owner === "object" && "token" in owner && owner.token === token)
        await unlink(filename).catch((error: unknown) => { if (!missingFile(error)) throw error; });
    }
  };
}
async function reclaim(filename: string) {
  const recovery = `${filename}.recovery`;
  let handle;
  try { handle = await open(recovery, "wx", 0o600); }
  catch { throw new ConnectionError("connection_busy", 409); }
  try {
    const owner: unknown = JSON.parse((await readPrivateFile(filename, 1024)).toString("utf8"));
    if (!owner || typeof owner !== "object" || !("pid" in owner) ||
      typeof owner.pid !== "number" || !Number.isInteger(owner.pid) || owner.pid < 1 || ownerIsAlive(owner.pid))
      throw new ConnectionError("connection_busy", 409);
    await unlink(filename);
  } finally { await handle.close(); await unlink(recovery); }
}
