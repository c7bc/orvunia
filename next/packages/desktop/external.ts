import { CuratedCatalog } from "../local-models/catalog.ts";

export function permittedExternalURL(
  value: unknown,
  serviceOrigin: string,
  cloudOrigin: string | null,
) {
  if (
    typeof value !== "string" ||
    value.length > 8192 ||
    /[\x00-\x20\x7f]/.test(value)
  )
    throw Error("Endereço externo inválido.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw Error("Endereço externo inválido.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error("Somente endereços HTTPS autorizados podem ser abertos.");
  if (cloudOrigin && url.origin === cloudOrigin) return url.href;
  const modelReferences = new CuratedCatalog().list().flatMap(model => [model.source, model.license.url]);
  if (modelReferences.some(reference => new URL(reference).href === url.href)) return url.href;
  const meetingHosts = [
    "meet.google.com",
    "calendar.google.com",
    "teams.microsoft.com",
    "teams.live.com",
    "outlook.office.com",
  ];
  if (
    !url.port &&
    (meetingHosts.includes(url.hostname) ||
      url.hostname === "zoom.us" ||
      url.hostname.endsWith(".zoom.us"))
  )
    return url.href;
  if (
    !url.port &&
    url.hostname === "checkout.stripe.com" &&
    /^\/c\/pay\/cs_[a-zA-Z0-9_]+\/?$/.test(url.pathname)
  )
    return url.href;
  if (
    !url.port &&
    url.hostname === "billing.stripe.com" &&
    /^\/p\/session(?:\/[a-zA-Z0-9_-]+)?\/?$/.test(url.pathname)
  )
    return url.href;
  if (
    !url.port &&
    url.hostname === "accounts.google.com" &&
    ["/o/oauth2/v2/auth", "/o/oauth2/auth"].includes(url.pathname)
  ) {
    let redirect: URL;
    try {
      redirect = new URL(url.searchParams.get("redirect_uri") || "");
    } catch {
      throw Error("Retorno do Google inválido.");
    }
    const scopes = (url.searchParams.get("scope") || "").split(/\s+/);
    if (
      redirect.origin === serviceOrigin &&
      redirect.pathname === "/api/calendar/callback" &&
      !redirect.username &&
      !redirect.password &&
      !redirect.search &&
      !redirect.hash &&
      url.searchParams.get("response_type") === "code" &&
      (url.searchParams.get("state") || "").length >= 20 &&
      scopes.length === 1 &&
      scopes[0] ===
        "https://www.googleapis.com/auth/calendar.events.readonly" &&
      url.searchParams.get("client_id") &&
      url.searchParams.get("code_challenge_method") === "S256" &&
      /^[a-zA-Z0-9_-]{43,128}$/.test(
        url.searchParams.get("code_challenge") || "",
      )
    )
      return url.href;
  }
  throw Error("Este endereço não está autorizado para abertura externa.");
}
