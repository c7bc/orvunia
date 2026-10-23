import type { ApplicationState } from "./model.js";
import { mergeSessionView } from "../history/merge.js";
import { applicationSession } from "./decoders.js";

export type ApplicationRequest = (
  path: string,
  method?: string,
  body?: unknown,
  signal?: AbortSignal,
  headers?: Record<string, string>,
) => Promise<unknown>;

export function createApplicationRequest(ports: {
  request(input: string, options: RequestInit): Promise<Response>;
  current(): ApplicationState["current"];
  locale(): string;
}): ApplicationRequest {
  return async (path, method = "GET", body, signal, extraHeaders = {}) => {
    if (method === "GET" && /^\/sessions\/[0-9a-f-]{36}$/i.test(path))
      path += "/view";
    const multipart = body instanceof FormData;
    const response = await ports.request("/api" + path, {
      method,
      credentials: "same-origin",
      headers: {
        "X-Cadence-Request": "1",
        "X-Cadence-History": "window",
        "Accept-Language": ports.locale(),
        ...(!multipart && body ? { "Content-Type": "application/json" } : {}),
        ...extraHeaders,
      },
      ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
    const data: unknown = await response.json();
    if (!response.ok) {
      const failure =
        data && typeof data === "object" && "error" in data ? data.error : null;
      const message =
        failure &&
        typeof failure === "object" &&
        "message" in failure &&
        typeof failure.message === "string"
          ? failure.message
          : "Não foi possível concluir.";
      throw Object.assign(Error(message), { status: response.status });
    }
    if (data && typeof data === "object" && "history" in data && data.history)
      return mergeSessionView(ports.current(), applicationSession(data));
    return data;
  };
}
