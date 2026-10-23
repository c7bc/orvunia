import { expect, test } from "bun:test";
import { syntheticAudioHelper } from "../support/system-audio-helper.ts";

test.skipIf(process.platform !== "win32")("PowerShell helper compiles without installing a runtime and passes synthetic PCM/format/protocol checks", async () => {
  const result = await syntheticAudioHelper("selftest");
  expect(result.exit).toBe(0);
  expect(result.status.trim()).toBe("");
  const report = JSON.parse(result.output.toString("utf8"));
  expect(report).toMatchObject({ passed: true, hardwareCapture: false, networkCalls: 0,
    sampleRate: 24000, channels: 1, outputFormat: "pcm_s16le" });
  expect(report.assertions).toBeGreaterThanOrEqual(24);
  expect(report.toneRms).toBeGreaterThan(0.34);
  expect(report.aliasRms).toBeLessThan(0.01);
}, 20_000);

test.skipIf(process.platform !== "win32")("capture helper receives EOF before start without opening a device or producing PCM", async () => {
  const result = await syntheticAudioHelper("capture");
  expect(result.exit).toBe(0);
  expect(result.output.length).toBe(0);
  expect(JSON.parse(result.status.trim())).toMatchObject({ event: "stopped", frames: 0 });
}, 20_000);

test.skipIf(process.platform !== "win32")("invalid capture command is rejected before WASAPI is initialized", async () => {
  const result = await syntheticAudioHelper("capture", '{"command":"unapproved"}\n');
  expect(result.exit).toBe(1);
  expect(result.output.length).toBe(0);
  expect(JSON.parse(result.status.trim())).toMatchObject({ event: "error", code: "command_invalid" });
}, 20_000);
