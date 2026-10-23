export async function consumeAnswerStream(
  response: Response,
  {
    signal,
    onDelta = () => {},
  }: {
    signal?: AbortSignal;
    onDelta?: (delta: string, text: string) => void;
  } = {},
) {
  if (!response.body) throw Error("O servidor não enviou uma resposta.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let pending = "",
    text = "",
    doneEvent = null,
    bytes = 0;
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Interrupted", "AbortError");
      const chunk = await reader.read();
      bytes += chunk.value?.byteLength || 0;
      if (bytes > 16 * 1024 * 1024)
        throw Error("A resposta ultrapassou o limite de tamanho.");
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(pending))) {
        const record = pending.slice(0, boundary.index);
        pending = pending.slice(boundary.index + boundary[0].length);
        if (record.length > 512 * 1024)
          throw Error("Um trecho da resposta ultrapassou o limite.");
        const event = record.match(/^event:\s*(.+)$/m)?.[1]?.trim();
        const data = record
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        const value: unknown = JSON.parse(data);
        if (!value || typeof value !== "object")
          throw Error("Trecho de resposta inválido.");
        const payload = value as Record<string, unknown>;
        if (event === "error")
          throw Object.assign(Error(
            typeof payload.message === "string"
              ? payload.message
              : "A resposta não pôde ser concluída.",
          ), { code: typeof payload.code === "string" && /^[a-z_]{1,80}$/.test(payload.code) ? payload.code : undefined,
            status: Number.isSafeInteger(payload.status) ? payload.status : undefined });
        if (event === "delta") {
          if (typeof payload.text !== "string")
            throw Error("Trecho de resposta inválido.");
          text += payload.text;
          if (text.length > 512 * 1024)
            throw Error(
              "A resposta ultrapassou o limite de texto do assistente.",
            );
          onDelta(payload.text, text);
        }
        if (event === "done") {
          if (
            typeof payload.text === "string" &&
            payload.text.length > 512 * 1024
          )
            throw Error(
              "A resposta ultrapassou o limite de texto do assistente.",
            );
          doneEvent = payload;
        }
      }
      if (pending.length > 512 * 1024)
        throw Error("Um trecho da resposta ultrapassou o limite.");
      if (chunk.done) break;
    }
    if (signal?.aborted) throw new DOMException("Interrupted", "AbortError");
    if (!doneEvent)
      throw Error("A resposta foi interrompida antes de concluir.");
    return { text, done: doneEvent };
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
