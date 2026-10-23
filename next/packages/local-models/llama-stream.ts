import { LocalModelError } from "./domain.ts";
import { unavailableTelemetry, type RuntimeMeasurement } from "./telemetry.ts";

type StreamEvent = { error?: unknown; choices?: { delta?: { content?: unknown } }[];
  timings?: { predicted_n?: unknown; predicted_ms?: unknown }; usage?: { completion_tokens?: unknown } };
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
export async function readLlamaStream(response: Response, signal: AbortSignal, started: number,
  now: () => number = () => performance.now()): Promise<RuntimeMeasurement> {
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream"))
    throw new LocalModelError("local_generation_invalid", 502);
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const telemetry = unavailableTelemetry("tokens-per-second:missing-valid-runtime-timings");
  telemetry.unavailableReasons = [];
  let buffer = "", output = "", done = false, receivedBytes = 0;
  let generatedTokens: number | null = null, generationMilliseconds: number | null = null;
  let cancelling: Promise<void> | null = null;
  const cancelReader = () => cancelling ??= reader.cancel().catch(() => undefined);
  const abort = () => { void cancelReader(); };
  signal.addEventListener("abort", abort, { once: true });
  const event = (block: string) => {
    const data = block.split(/\r?\n/).filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).replace(/^ /, "")).join("\n");
    if (!data) return;
    if (data === "[DONE]") { done = true; return; }
    const value = JSON.parse(data) as StreamEvent;
    if (!value || typeof value !== "object" || value.error) throw new LocalModelError("local_generation_invalid", 502);
    const content = value.choices?.[0]?.delta?.content;
    if (content !== undefined && content !== null && typeof content !== "string") throw new LocalModelError("local_generation_invalid", 502);
    if (typeof content === "string" && content.length) {
      if (telemetry.timeToFirstTokenMilliseconds === null) {
        telemetry.timeToFirstTokenMilliseconds = Math.max(0, now() - started);
        telemetry.provenance.timeToFirstToken = "client-monotonic-first-content";
      }
      output += content;
      if (output.length > 128 * 1024) throw new LocalModelError("local_generation_invalid", 502);
    }
    const timings = value.timings;
    if (positive(timings?.predicted_n) && Number.isSafeInteger(timings.predicted_n) && positive(timings.predicted_ms)) {
      generatedTokens = timings.predicted_n; generationMilliseconds = timings.predicted_ms;
      telemetry.provenance.tokensPerSecond = "llama-predicted-n-over-predicted-ms";
    } else if (generationMilliseconds === null && positive(value.usage?.completion_tokens)
      && Number.isSafeInteger(value.usage.completion_tokens)) generatedTokens = value.usage.completion_tokens;
  };
  try {
    signal.throwIfAborted();
    while (!done) {
      const next = await reader.read();
      signal.throwIfAborted();
      if (next.done) { buffer += decoder.decode(); break; }
      receivedBytes += next.value.byteLength;
      if (receivedBytes > 4 * 1024 ** 2) throw new LocalModelError("local_generation_invalid", 502);
      buffer += decoder.decode(next.value, { stream: true });
      if (buffer.length > 256 * 1024) throw new LocalModelError("local_generation_invalid", 502);
      for (;;) {
        const boundary = /\r?\n\r?\n/.exec(buffer);
        if (!boundary) break;
        const block = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        event(block);
        if (done) break;
      }
    }
    if (!done || !output.trim()) throw new LocalModelError("local_generation_invalid", 502);
    telemetry.generatedTokens = generatedTokens; telemetry.generationMilliseconds = generationMilliseconds;
    const rate = generatedTokens !== null && generationMilliseconds !== null ? generatedTokens * 1000 / generationMilliseconds : null;
    if (rate !== null && Number.isFinite(rate) && rate > 0) telemetry.tokensPerSecond = rate;
    else {
      telemetry.provenance.tokensPerSecond = null;
      telemetry.unavailableReasons.push("tokens-per-second:missing-valid-runtime-timings");
    }
    return { output, telemetry };
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof LocalModelError) throw error;
    throw new LocalModelError("local_generation_invalid", 502);
  } finally {
    signal.removeEventListener("abort", abort);
    await cancelReader();
    reader.releaseLock();
  }
}
