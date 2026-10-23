import { LocalModelError, type ModelFile } from "./domain.ts";
import type { DownloadResponse, DownloadTransport } from "./ports.ts";
import { downloadActivity, progressingBody } from "./download-deadline.ts";

function approved(url: URL): boolean {
  return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") &&
    (url.hostname === "huggingface.co" || url.hostname.endsWith(".hf.co") || url.hostname.endsWith(".huggingface.co"));
}
export class HttpsModelTransport implements DownloadTransport {
  constructor(private readonly request: typeof fetch = fetch, private readonly inactivityMilliseconds = 30_000) {
    if (!Number.isSafeInteger(inactivityMilliseconds) || inactivityMilliseconds <= 0)
      throw new LocalModelError("download_configuration_invalid");
  }
  async open(file: ModelFile, offset: number, etag: string | null, signal: AbortSignal): Promise<DownloadResponse> {
    const controller = new AbortController();
    const combined = AbortSignal.any([signal, controller.signal]);
    let url = new URL(file.url);
    const headers: Record<string, string> = { "Accept-Encoding": "identity" };
    if (offset && etag) { headers.Range = `bytes=${offset}-`; headers["If-Range"] = etag; }
    for (let redirects = 0; redirects <= 5; redirects++) {
      if (!approved(url)) throw new LocalModelError("download_origin_denied");
      const response = await downloadActivity(() => this.request(url, { headers, signal: combined, redirect: "manual" }),
        combined, controller, this.inactivityMilliseconds);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location) throw new LocalModelError("download_redirect_invalid", 502);
        url = new URL(location, url);
        continue;
      }
      if (![200, 206].includes(response.status) || !response.body) {
        await response.body?.cancel();
        throw new LocalModelError(response.status === 401 || response.status === 403 ? "download_access_required" : "download_unavailable", 502);
      }
      return { status: response.status, etag: response.headers.get("etag"),
        contentRange: response.headers.get("content-range"),
        body: progressingBody(response.body, combined, controller, this.inactivityMilliseconds) };
    }
    throw new LocalModelError("download_redirect_limit", 502);
  }
}
