export function repositoryProviderStream(response: Record<string, unknown>, options: {
  beforeComplete?: () => Promise<void>; truncate?: boolean; signal?: AbortSignal;
  afterFirstText?: () => Promise<void>;
} = {}) {
  const encoder = new TextEncoder();
  let cancelled = false;
  return new Response(new ReadableStream<Uint8Array>({
    async start(output) {
      const emit = (event: Record<string, unknown>) => {
        if (!cancelled) output.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        emit({ type: "response.created", response: { ...response, output: [], usage: null, status: "in_progress" } });
        const items = response.output as { type: string; id: string; content?: { type: string; text: string }[] }[];
        let first = true;
        for (const [index, item] of items.entries()) {
          if (item.type !== "message") continue;
          for (const part of item.content ?? []) if (part.type === "output_text") {
            for (const delta of part.text.match(/.{1,12}|\n/gu) ?? []) {
              emit({ type: "response.output_text.delta", item_id: item.id, output_index: index, content_index: 0, delta });
              if (first) { first = false; await options.afterFirstText?.(); }
              if (cancelled) return;
            }
          }
        }
        await options.beforeComplete?.();
        if (cancelled) return;
        if (!options.truncate) emit({ type: `response.${String(response.status)}`, response });
        output.close();
      } catch (error) { if (!cancelled) output.error(error); }
    },
    cancel() { cancelled = true; },
  }), { headers: { "Content-Type": "text/event-stream" } });
}
