import { expect, test } from "bun:test";
import { createApiClient } from "../../../client/http/api.ts";
test("shared HTTP client preserves multipart bodies and caller headers without forcing their content type", async () => {
  const seen: RequestInit[] = [];
  const client = createApiClient(async (_, options) => {
    seen.push(options!);
    return Response.json({ saved: true });
  });
  const body = new FormData();
  body.set("file", new Blob(["synthetic"]), "synthetic.txt");
  expect(
    await client.request("/synthetic", {
      method: "POST",
      body,
      headers: new Headers({ "X-Test": "preserved" }),
    }),
  ).toEqual({ saved: true });
  expect(seen[0]!.body).toBe(body);
  const headers = new Headers(seen[0]!.headers);
  expect(headers.get("X-Test")).toBe("preserved");
  expect(headers.get("X-Cadence-Request")).toBe("1");
  expect(headers.has("Content-Type")).toBe(false);
  await client.request("/synthetic", {
    method: "PUT",
    body: { title: "Preserved" },
  });
  expect(seen[1]!.body).toBe('{"title":"Preserved"}');
  expect(new Headers(seen[1]!.headers).get("content-type")).toBe(
    "application/json",
  );
  const failed = createApiClient(async () =>
    Response.json({ error: { message: "Synthetic refusal" } }, { status: 409 }),
  );
  await expect(failed.request("/synthetic")).rejects.toThrow(
    "Synthetic refusal",
  );
});
test("shared answer client handles split CRLF frames, UTF-8 and a confirmed final result, then releases its reader", async () => {
  const encoded = new TextEncoder().encode(
    'event: delta\r\ndata: {"text":"ação"}\r\n\r\nevent: done\r\ndata: {"id":"synthetic","text":"ação"}\r\n\r\n',
  );
  let cancelled = 0;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < encoded.length; offset += 3)
        controller.enqueue(encoded.slice(offset, offset + 3));
      controller.close();
    },
    cancel() {
      cancelled++;
    },
  });
  const client = createApiClient(async () => new Response(stream));
  const deltas: string[] = [];
  const result = await client.answer(
    "synthetic",
    {},
    new AbortController().signal,
    (delta) => deltas.push(delta),
  );
  expect(result).toEqual({ id: "synthetic", text: "ação" });
  expect(deltas).toEqual(["ação"]);
  expect(stream.locked).toBe(false);
  expect(cancelled).toBe(0);
});
