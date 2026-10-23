import { expect, test } from "bun:test";
import { join } from "node:path";
import { systemAudioFixture, syntheticCatalog, syntheticEndpoint } from "../support/system-audio-fixture.ts";
import { systemAudioHelperEnvironment } from "../../packages/desktop/system-audio/helper.ts";

test("system audio listing is read-only and unsupported hosts never launch a process", async () => {
  const fixture = systemAudioFixture();
  expect(await fixture.manager.invoke(12, { action: "list" })).toEqual(syntheticCatalog);
  expect(fixture.actions).toEqual(["enumerate"]);
  fixture.support(false);
  expect(await fixture.manager.invoke(12, { action: "list" })).toMatchObject({ supported: false, endpoints: [] });
  await expect(fixture.start().pending).rejects.toMatchObject({ code: "system_audio_unsupported" });
  expect(fixture.actions).toEqual(["enumerate"]);
});

test("system audio requires explicit consent, valid endpoint and active owner before spawning", async () => {
  const fixture = systemAudioFixture();
  const input = { action: "start", captureId: crypto.randomUUID(), sessionId: crypto.randomUUID(), endpointId: syntheticEndpoint };
  await expect(fixture.manager.invoke(12, input)).rejects.toBeDefined();
  await expect(fixture.manager.invoke(12, { ...input, consent: true, endpointId: "x'; Start-Process calc" })).rejects.toBeDefined();
  fixture.allow(false);
  await expect(fixture.manager.invoke(12, { ...input, consent: true })).rejects.toMatchObject({ code: "system_audio_owner_changed" });
  expect(fixture.actions).toEqual([]);
});

test("system audio assembles split PCM, scopes receipts and waits for a real flush watermark", async () => {
  const fixture = systemAudioFixture(), capture = fixture.start();
  expect(await capture.pending).toMatchObject({ captureId: capture.input.captureId, endpointId: syntheticEndpoint });
  fixture.data(new Uint8Array([0, 64, 0])); fixture.data(new Uint8Array([32]));
  const frames = fixture.events.filter((event) => event.type === "pcm");
  expect(frames).toHaveLength(2);
  expect(frames[0]).toMatchObject({ sequence: 0, data: new Uint8Array([0, 64]), rms: 0.5 });
  await expect(fixture.manager.invoke(15, { action: "ack", captureId: capture.input.captureId, sequence: 1 })).rejects.toBeDefined();
  fixture.flushTarget(4);
  let flushed = false;
  const pending = fixture.manager.invoke(12, { action: "flush", captureId: capture.input.captureId, id: crypto.randomUUID() })
    .then((value) => { flushed = true; return value; });
  await Bun.sleep(5); expect(flushed).toBe(false);
  fixture.data(new Uint8Array(4));
  expect(await pending).toEqual({ frames: 4 });
  expect(await fixture.manager.invoke(12, { action: "ack", captureId: capture.input.captureId, sequence: 2 })).toEqual({ acknowledged: true });
  expect(await fixture.manager.invoke(12, { action: "stop", captureId: capture.input.captureId })).toEqual({ stopped: true, frames: 4 });
  expect(await fixture.manager.invoke(12, { action: "ack", captureId: capture.input.captureId, sequence: 2 })).toEqual({ acknowledged: true });
  await expect(fixture.manager.invoke(12, capture.input)).rejects.toMatchObject({ code: "system_audio_request_conflict" });
});

test("system audio backpressure stops the helper instead of retaining unbounded audio", async () => {
  const fixture = systemAudioFixture(), capture = fixture.start(); await capture.pending;
  fixture.data(new Uint8Array(480000)); fixture.data(new Uint8Array(2));
  await Bun.sleep(5);
  expect(fixture.events.some((event) => event.type === "error" && event.code === "system_audio_backpressure")).toBe(true);
  expect(fixture.commands.filter((command) => command.command === "stop")).toHaveLength(1);
  expect(fixture.events.filter((event) => event.type === "pcm")).toHaveLength(15);
});

test("system audio stops on renderer loss and rejects a cancelled startup without leaking another capture", async () => {
  const fixture = systemAudioFixture(); fixture.ready(false);
  const first = fixture.start();
  const rejected = first.pending.catch((error: unknown) => error);
  await fixture.manager.senderGone(12).catch(() => {});
  expect(await rejected).toMatchObject({ code: "system_audio_stopped" });
  fixture.ready(true);
  const next = fixture.start(); await next.pending;
  fixture.allow(false); fixture.data(new Uint8Array(2)); await Bun.sleep(5);
  expect(fixture.events.some((event) => event.type === "error" && event.code === "system_audio_owner_changed")).toBe(true);
});

test("system audio rejects an unexpected endpoint and malformed helper metadata", async () => {
  const fixture = systemAudioFixture(); fixture.ready(false);
  const captureId = crypto.randomUUID();
  const pending = fixture.manager.invoke(12, { action: "start", captureId, sessionId: crypto.randomUUID(),
    endpointId: syntheticEndpoint, consent: true });
  const rejected = pending.catch((error: unknown) => error);
  fixture.metadata({ event: "ready", endpointId: "another-device", sampleRate: 24000, channels: 1, format: "pcm_s16le" });
  expect(await rejected).toMatchObject({ code: "system_audio_endpoint_mismatch" });
  const next = fixture.start();
  const malformed = next.pending.catch((error: unknown) => error);
  fixture.metadata({ event: "ready", endpointId: syntheticEndpoint, sampleRate: 48000, channels: 1, format: "pcm_s16le" });
  expect(await malformed).toMatchObject({ code: "system_audio_protocol" });
});

test("system audio helpers inherit only the Windows runtime environment without provider or identity credentials", () => {
  const result = systemAudioHelperEnvironment({ SystemRoot: "C:\\Windows", TEMP: "C:\\Temp", OPENAI_API_KEY: "never-in-child",
    CADENCE_AUTH_SECRET: "never-in-child", PATH: "C:\\untrusted", DATABASE_URL: "never-in-child" });
  expect(result.environment).toEqual({ SystemRoot: "C:\\Windows", TEMP: "C:\\Temp", PATH: join("C:\\Windows", "System32") });
  expect(result.executable).toBe(join("C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"));
});
