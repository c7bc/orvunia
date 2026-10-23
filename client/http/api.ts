import { consumeAnswerStream } from "../coding/stream.js";
export type ApiRequestOptions = Omit<RequestInit, "body"> & { body?: unknown };
function failure(value: unknown, fallback: string) {
  if (!value || typeof value !== "object" || !("error" in value))
    return fallback;
  const error = value.error;
  return error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : fallback;
}
export function createApiClient(
  request: (input: string, options?: RequestInit) => Promise<Response> = fetch,
) {
  return {
    async request(
      path: string,
      options: ApiRequestOptions = {},
    ): Promise<unknown> {
      const multipart = options.body instanceof FormData;
      const headers = new Headers(options.headers);
      headers.set("X-Cadence-Request", "1");
      if (!multipart && options.body && !headers.has("Content-Type"))
        headers.set("Content-Type", "application/json");
      const { body, ...configuration } = options;
      const response = await request("/api" + path, {
        ...configuration,
        credentials: "same-origin",
        headers,
        ...(body
          ? { body: multipart ? (body as FormData) : JSON.stringify(body) }
          : {}),
      });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok)
        throw Error(failure(data, "Não foi possível acessar o servidor."));
      return data;
    },
    async answer(
      sessionId: string,
      input: unknown,
      signal: AbortSignal,
      onDelta: (delta: string) => void,
    ) {
      const response = await request(`/api/sessions/${sessionId}/answers`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Cadence-Request": "1",
        },
        body: JSON.stringify(input),
        signal,
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => ({}));
        throw Error(failure(body, "Não foi possível preparar a resposta."));
      }
      const result = await consumeAnswerStream(response, { signal, onDelta });
      return result.done;
    },
  };
}
