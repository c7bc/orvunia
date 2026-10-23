import { consumeAnswerStream } from "../coding/stream.js";

export async function streamRepositoryTurn(fetch: (path: string, options: RequestInit) => Promise<Response>,
  path: string, signal: AbortSignal, onText: (text: string) => void) {
  signal.throwIfAborted();
  onText("");
  const response = await fetch(path, { method: "POST", signal });
  if (!response.ok) throw Object.assign(Error("repository_stream_failed"), { status: response.status });
  if (!response.headers.get("content-type")?.startsWith("text/event-stream"))
    throw Error("repository_stream_invalid");
  const result = await consumeAnswerStream(response, { signal, onDelta: (_delta, text) => onText(text) });
  signal.throwIfAborted();
  return result.done;
}
