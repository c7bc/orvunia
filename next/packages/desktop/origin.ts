export function configuredCloudOrigin(value: unknown): string | null {
  if (!value) return null;
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    /[\x00-\x20\x7f]/.test(value)
  )
    throw Error("CADENCE_CLOUD_URL deve ser uma origem HTTPS válida.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw Error("CADENCE_CLOUD_URL deve ser uma origem HTTPS válida.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error(
      "CADENCE_CLOUD_URL deve conter somente a origem HTTPS, sem caminho ou credenciais.",
    );
  return url.origin;
}
export function matchesOrigin(value: string, expected: string) {
  try {
    const url = new URL(value);
    return url.origin === expected && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function isDesktopDocument(value: string, expected: string) {
  try {
    return (
      matchesOrigin(value, expected) &&
      new URL(value).pathname === "/desktop.html"
    );
  } catch {
    return false;
  }
}
