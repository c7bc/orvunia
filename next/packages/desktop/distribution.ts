export type DesktopDistribution =
  | { channel: "msix"; updates: "windows-store"; startup: "windows-settings" }
  | { channel: "standalone"; updates: "release"; startup: "native" };
export function nativeDistribution(process: { platform: string; windowsStore?: boolean }): DesktopDistribution {
  return process.platform === "win32" && process.windowsStore === true
    ? { channel: "msix", updates: "windows-store", startup: "windows-settings" }
    : { channel: "standalone", updates: "release", startup: "native" };
}
export function readDistribution(value: unknown): DesktopDistribution {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 3 ||
      !["channel", "updates", "startup"].every(key => Object.hasOwn(value, key)))
    throw Error("Invalid desktop distribution");
  const input = value as Record<string, unknown>;
  if (input.channel === "msix" && input.updates === "windows-store" && input.startup === "windows-settings")
    return { channel: "msix", updates: "windows-store", startup: "windows-settings" };
  if (input.channel === "standalone" && input.updates === "release" && input.startup === "native")
    return { channel: "standalone", updates: "release", startup: "native" };
  throw Error("Invalid desktop distribution");
}
