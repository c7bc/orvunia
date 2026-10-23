import { expect, test } from "bun:test";
import { HttpsModelTransport } from "../../packages/local-models/transport.ts";
import { syntheticManifest } from "../support/local-models.ts";
import { validatePcmWave } from "../../packages/local-models/wave.ts";
import { modelDownloadInput, modelLoadInput } from "../../packages/local-models/contracts.ts";

test("redirects never reach unapproved origins and never send provider secrets", async () => {
  const requests: RequestInit[] = [];
  const request = new Proxy(fetch, { apply(_target, _receiver, argumentsList: [URL, RequestInit]) {
    requests.push(argumentsList[1]);
    return Promise.resolve(new Response(null, { status: 302, headers: { location: "http://127.0.0.1:9999/steal" } }));
  } });
  const transport = new HttpsModelTransport(request);
  await expect(transport.open(syntheticManifest().files[0]!, 0, null, new AbortController().signal)).rejects.toThrow("download_origin_denied");
  expect(requests).toHaveLength(1);
  expect(requests[0]?.headers).not.toHaveProperty("Authorization");
});
test("strong ETag resume carries If-Range to the official HTTPS transport", async () => {
  let headers: HeadersInit | undefined;
  const request = new Proxy(fetch, { apply(_target, _receiver, argumentsList: [URL, RequestInit]) {
    headers = argumentsList[1].headers;
    return Promise.resolve(new Response("abc", { status: 206, headers: { etag: '"fixed"', "Content-Range": "bytes 3-5/6" } }));
  } });
  const result = await new HttpsModelTransport(request).open(syntheticManifest().files[0]!, 3, '"fixed"', new AbortController().signal);
  expect(headers).toMatchObject({ Range: "bytes=3-", "If-Range": '"fixed"' });
  expect(result.status).toBe(206); await result.body.cancel();
});
test("PCM parser rejects arbitrary bytes, WebM and malformed RIFF before native execution", () => {
  expect(() => validatePcmWave(new Uint8Array(44))).toThrow("local_audio_invalid");
  expect(() => validatePcmWave(Buffer.from("not a wave"))).toThrow("local_audio_invalid");
  const audio = Buffer.alloc(46); audio.write("RIFF"); audio.writeUInt32LE(38, 4); audio.write("WAVE", 8);
  audio.write("fmt ", 12); audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(16000, 24); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
  audio.write("data", 36); audio.writeUInt32LE(2, 40);
  expect(() => validatePcmWave(audio)).not.toThrow();
  audio.writeUInt32LE(48000, 24);
  expect(() => validatePcmWave(audio)).toThrow("local_audio_requires_pcm16_mono_16khz");
});
test("download and load contracts reject commands, remote URLs and excessive limits", () => {
  expect(modelDownloadInput.safeParse({ requestId: crypto.randomUUID(), catalogId: "tiny", revision: "a".repeat(40), url: "https://evil.test/a" }).success).toBe(false);
  expect(modelLoadInput.safeParse({ contextTokens: 4096, maximumOutputTokens: 256, threads: 1024 }).success).toBe(false);
});
