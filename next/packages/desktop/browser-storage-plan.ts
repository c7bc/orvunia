import type { BrowserStorageEntries } from "./browser-storage-types.ts";

const settings = new Set([
  "cadence-agenda",
  "cadence-selected-mode",
  "cadence-ui-locale",
  "cadence-v3-news-dismissed",
  "cadence-desktop-preview",
]);
export function desktopBrowserOrigin(value: string) {
  if (!/^http:\/\/127\.0\.0\.1:(?:879[0-9]|880[0-9])$/.test(value))
    throw Error("Invalid desktop browser storage origin");
  return value;
}
export function desktopBrowserOrigins() {
  return Array.from(
    { length: 20 },
    (_, index) => `http://127.0.0.1:${8790 + index}`,
  );
}
export function desktopStorageKey(value: string) {
  return (
    settings.has(value) ||
    /^cadence-agenda:[a-f0-9]{24}$/.test(value) ||
    /^cadence-followup:cadence-agenda:[a-f0-9]{24}:[a-f0-9-]{36}$/.test(value)
  );
}
export function desktopStorageEntries(value: unknown): BrowserStorageEntries {
  if (!Array.isArray(value) || value.length > 4096)
    throw Error("Invalid desktop browser storage snapshot");
  const selected = new Map<string, string>();
  let bytes = 0;
  for (const entry of value) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== "string" ||
      typeof entry[1] !== "string"
    )
      throw Error("Invalid desktop browser storage entry");
    if (!desktopStorageKey(entry[0])) continue;
    bytes += Buffer.byteLength(entry[0]) + Buffer.byteLength(entry[1]);
    if (selected.has(entry[0]) || bytes > 8 * 1024 * 1024)
      throw Error("Desktop browser storage exceeds its migration limits");
    selected.set(entry[0], entry[1]);
  }
  return [...selected].sort(([first], [second]) => first.localeCompare(second));
}
export function mergeDesktopStorage(
  snapshots: readonly BrowserStorageEntries[],
) {
  const merged = new Map<string, string>();
  for (const entries of snapshots)
    for (const [key, value] of entries) {
      if (merged.has(key) && merged.get(key) !== value)
        throw Error(
          "Desktop browser storage has conflicting values across origins",
        );
      merged.set(key, value);
    }
  return desktopStorageEntries([...merged]);
}
