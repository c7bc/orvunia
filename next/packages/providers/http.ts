import { ProviderError } from "./domain.ts";

export type HttpFetch = (
  input: RequestInfo | URL,
  options?: RequestInit,
) => Promise<Response>;
export async function checked(response: Response) {
  if (response.ok) return response;
  await response.body?.cancel();
  throw new ProviderError(
    response.status === 401 || response.status === 403
      ? "provider_auth"
      : response.status === 429
        ? "provider_limit"
        : "provider_request",
    response.status === 429 ? 429 : 502,
  );
}
export function boundedFetch(transport: HttpFetch): HttpFetch {
  const request: HttpFetch = async (input, options) => {
    const response = await transport(input, { ...options, redirect: "error" });
    let streaming = response.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("text/event-stream");
    if (typeof options?.body === "string") {
      try {
        streaming ||= JSON.parse(options.body).stream === true;
      } catch {
        /* Multipart uploads are not JSON. */
      }
    }
    if (!response.body) return response;
    const reader = response.body.getReader();
    let total = 0,
      record = 0,
      line = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await reader.read();
          if (done) {
            reader.releaseLock();
            controller.close();
            return;
          }
          total += value.byteLength;
          if (total > (streaming ? 16 : 2) * 1024 * 1024)
            throw new ProviderError("provider_unavailable");
          if (streaming)
            for (const byte of value) {
              if (++record > 512 * 1024)
                throw new ProviderError("provider_unavailable");
              if (byte === 10) {
                if (line === 0) record = 0;
                line = 0;
              } else if (byte !== 13) line++;
            }
          controller.enqueue(value);
        } catch (error) {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
          controller.error(error);
        }
      },
      async cancel(reason) {
        await reader.cancel(reason).catch(() => {});
        reader.releaseLock();
      },
    });
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
  return Object.assign(request, { Response });
}
