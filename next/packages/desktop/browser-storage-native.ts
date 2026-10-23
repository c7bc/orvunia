import type {
  BrowserStoragePort,
  BrowserStorageWindow,
  BrowserStorageSession,
  BrowserStorageEntries,
} from "./browser-storage-types.ts";
import {
  desktopBrowserOrigin,
  desktopStorageKey,
  desktopStorageEntries,
} from "./browser-storage-plan.ts";

export async function nativeBrowserStorage(options: {
  session: BrowserStorageSession;
  createWindow(): BrowserStorageWindow;
  assertQuiescent(): void;
  signal: AbortSignal;
}): Promise<BrowserStoragePort> {
  options.assertQuiescent();
  options.signal.throwIfAborted();
  if (await options.session.protocol.isProtocolHandled("http"))
    throw Error(
      "Browser storage migration requires an unmodified HTTP protocol",
    );
  options.signal.throwIfAborted();
  const pathname = `/__cadence_storage_${crypto.randomUUID()}`;
  let window: BrowserStorageWindow | null = null,
    closed = false;
  let deadline: ReturnType<typeof setTimeout> | null = null;
  const close = () => {
    if (closed) return;
    closed = true;
    if (deadline) clearTimeout(deadline);
    options.signal.removeEventListener("abort", close);
    try {
      window?.destroy();
    } finally {
      options.session.protocol.unhandle("http");
    }
  };
  options.session.protocol.handle("http", (request) => {
    const url = new URL(request.url);
    let allowed = false;
    try {
      allowed = desktopBrowserOrigin(url.origin) === url.origin;
    } catch {}
    return new Response(
      allowed && url.pathname === pathname
        ? "<!doctype html><title>Cadence storage</title>"
        : "",
      {
        status: allowed && url.pathname === pathname ? 200 : 403,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-security-policy":
            "default-src 'none'; frame-ancestors 'none'",
        },
      },
    );
  });
  options.signal.addEventListener("abort", close, { once: true });
  deadline = setTimeout(close, 20000);
  try {
    options.signal.throwIfAborted();
    window = options.createWindow();
    if (window.webContents.session !== options.session)
      throw Error(
        "Browser storage migration window must use its owning session",
      );
  } catch (error) {
    close();
    throw error;
  }
  async function evaluate(origin: string, script: string) {
    desktopBrowserOrigin(origin);
    options.signal.throwIfAborted();
    if (closed || !window) throw Error("Browser storage migration is closed");
    const url = origin + pathname;
    await window.loadURL(url);
    if (window.webContents.getURL() !== url)
      throw Error("Unexpected browser storage navigation");
    const result = await window.webContents.executeJavaScript(script);
    options.signal.throwIfAborted();
    if (closed || window.webContents.getURL() !== url)
      throw Error("Browser storage navigation changed");
    return result;
  }
  return {
    read: (origin) => evaluate(origin, "Object.entries(localStorage)"),
    async replace(origin: string, entries: BrowserStorageEntries) {
      const selected = desktopStorageEntries(entries);
      const keys = (await evaluate(
        origin,
        "Object.keys(localStorage)",
      )) as unknown;
      if (!Array.isArray(keys) || !keys.every((key) => typeof key === "string"))
        throw Error("Invalid browser storage keys");
      const wanted = new Set(selected.map(([key]) => key));
      const remove = keys.filter(
        (key) => desktopStorageKey(key) && !wanted.has(key),
      );
      await evaluate(
        origin,
        `(()=>{for(const [key,value] of ${JSON.stringify(selected)})localStorage.setItem(key,value);for(const key of ${JSON.stringify(remove)})localStorage.removeItem(key);return true;})()`,
      );
      options.session.flushStorageData();
    },
    close,
  };
}
