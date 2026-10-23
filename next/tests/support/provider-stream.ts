export function providerStream(events: unknown[], chunkSize = 7) {
  const data = new TextEncoder().encode(
    events
      .map(
        (event) =>
          `data: ${typeof event === "string" ? event : JSON.stringify(event)}\r\n\r\n`,
      )
      .join(""),
  );
  let offset = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= data.byteLength) {
          controller.close();
          return;
        }
        controller.enqueue(data.slice(offset, offset + chunkSize));
        offset += chunkSize;
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
}
