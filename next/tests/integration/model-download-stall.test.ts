import { expect, test } from "bun:test";
import { ModelDownloads } from "../../packages/local-models/downloads.ts";
import { HttpsModelTransport } from "../../packages/local-models/transport.ts";
import { modelFixture, syntheticManifest } from "../support/local-models.ts";

test("stalled headers abort the owned fetch instead of leaving a download pending", async () => {
  let signal: AbortSignal | undefined;
  const request = new Proxy(fetch, { apply(_target, _receiver, [, options]: [URL, RequestInit]) {
    signal = options.signal!;
    return new Promise<Response>(() => {});
  } });
  const transport = new HttpsModelTransport(request, 20);
  await expect(transport.open(syntheticManifest().files[0]!, 0, null, new AbortController().signal))
    .rejects.toThrow("download_stalled");
  expect(signal?.aborted).toBe(true);
});

test("stalled body remains resumable with its exact partial bytes and strong ETag", async () => {
  const fixture = await modelFixture("abcdef");
  let cancelled = false;
  let attempts = 0;
  const request = new Proxy(fetch, { apply(_target, _receiver, [, options]: [URL, RequestInit]) {
    attempts++;
    if (attempts > 1) {
      expect(options.headers).toMatchObject({ Range: "bytes=3-", "If-Range": '"fixed"' });
      return Promise.resolve(new Response("def", { status: 206, headers: { etag: '"fixed"', "content-range": "bytes 3-5/6" } }));
    }
    return Promise.resolve(new Response(new ReadableStream<Uint8Array>({
      start(output) { output.enqueue(Buffer.from("abc")); },
      cancel() { cancelled = true; },
    }), { headers: { etag: '"fixed"' } }));
  } });
  const downloads = new ModelDownloads(fixture.catalog, fixture.registry, fixture.artifacts, new HttpsModelTransport(request, 30));
  try {
    const job = downloads.create({ requestId: fixture.requestId, catalogId: fixture.manifest.id, revision: fixture.manifest.revision });
    const failed = await downloads.run(job.id);
    expect(failed).toMatchObject({ state: "failed", errorCode: "download_stalled", retryable: true, bytesDone: 3 });
    expect(cancelled).toBe(true);
    expect(fixture.registry.listInstallations()).toEqual([]);
    expect(await fixture.artifacts.partial(job.id, fixture.manifest.files[0]!)).toEqual({ bytes: 3 });
    expect((await downloads.run(job.id)).state).toBe("installed");
    expect(await fixture.artifacts.has(fixture.manifest.files[0]!)).toBe(true);
  } finally { await downloads.close(); await fixture.close(); }
});

test("active downloads may exceed the inactivity window in total duration", async () => {
  const bytes = Buffer.from("abcdef");
  let offset = 0;
  const request = new Proxy(fetch, { apply() {
    return Promise.resolve(new Response(new ReadableStream<Uint8Array>({
      async pull(output) {
        await Bun.sleep(15);
        if (offset === bytes.length) output.close();
        else output.enqueue(bytes.subarray(offset, ++offset));
      },
    }, { highWaterMark: 0 })));
  } });
  const response = await new HttpsModelTransport(request, 60).open(syntheticManifest().files[0]!, 0, null, new AbortController().signal);
  expect(await new Response(response.body).text()).toBe("abcdef");
});

test("user cancellation aborts pending body reads without converting them to timeout", async () => {
  const external = new AbortController();
  const request = new Proxy(fetch, { apply() { return Promise.resolve(new Response(new ReadableStream<Uint8Array>({}))); } });
  const response = await new HttpsModelTransport(request, 1000).open(syntheticManifest().files[0]!, 0, null, external.signal);
  const pending = response.body.getReader().read();
  external.abort(new Error("synthetic user cancellation"));
  await expect(pending).rejects.toThrow("synthetic user cancellation");
});
