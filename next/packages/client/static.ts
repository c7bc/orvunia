import { realpath, lstat, readFile } from "node:fs/promises";
import { resolve, join, sep, extname } from "node:path";
import { clientCatalog } from "./catalog.ts";
const mime: Record<string, string> = {
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain",
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
export async function staticClient(
  directory: string,
  vendorDirectory?: string,
) {
  const root = await realpath(resolve(directory)),
    vendors = vendorDirectory ? await realpath(resolve(vendorDirectory)) : root,
    files = await clientCatalog(root);
  return async (request: Request): Promise<Response | null> => {
    if (request.method !== "GET" && request.method !== "HEAD") return null;
    const relative = files.get(new URL(request.url).pathname);
    if (!relative) return null;
    const base = relative.startsWith("node_modules/") ? vendors : root;
    const filename = join(base, relative);
    const actual = await realpath(filename).catch((error: unknown) => {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "ENOENT" || error.code === "ENOTDIR")
      )
        return null;
      throw error;
    });
    if (!actual) return null;
    if (!actual.startsWith(base + sep) || !(await lstat(actual)).isFile())
      return null;
    const body =
      request.method === "HEAD" ? null : new Uint8Array(await readFile(actual));
    const websocket = new URL(request.url).origin.replace(/^http/, "ws");
    return new Response(body, {
      headers: {
        "content-type": mime[extname(actual)] ?? "application/octet-stream",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "content-security-policy": `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self' ${websocket}; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
      },
    });
  };
}
