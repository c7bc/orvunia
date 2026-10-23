import type { BrowserStoragePort } from "./browser-storage-types.ts";
import {
  desktopBrowserOrigin,
  desktopBrowserOrigins,
  desktopStorageEntries,
  mergeDesktopStorage,
} from "./browser-storage-plan.ts";
import {
  readBrowserStorageOrigin,
  writeBrowserStorageOrigin,
} from "./browser-storage-pointer.ts";

export async function preserveDesktopBrowserStorage(options: {
  profile: string;
  origin: string;
  signal: AbortSignal;
  open(): Promise<BrowserStoragePort>;
}) {
  const origin = desktopBrowserOrigin(options.origin);
  options.signal.throwIfAborted();
  const previous = await readBrowserStorageOrigin(options.profile);
  const storage = await options.open();
  try {
    const sources = previous ? [previous] : desktopBrowserOrigins();
    const snapshots = [];
    for (const source of sources) {
      options.signal.throwIfAborted();
      snapshots.push(desktopStorageEntries(await storage.read(source)));
    }
    const entries = previous ? snapshots[0]! : mergeDesktopStorage(snapshots);
    options.signal.throwIfAborted();
    if (previous !== origin) await storage.replace(origin, entries);
    options.signal.throwIfAborted();
    const verified = desktopStorageEntries(await storage.read(origin));
    if (JSON.stringify(verified) !== JSON.stringify(entries))
      throw Error("Desktop browser storage verification failed");
    await writeBrowserStorageOrigin(options.profile, origin);
    return { entries: entries.length, moved: previous !== origin };
  } finally {
    storage.close();
  }
}
