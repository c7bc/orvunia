import { expect, test } from "bun:test";
import { restoreNativePreferences, nativePreferenceUpdate } from "../../packages/desktop/preference-validation.ts";
test("computer endpoint preference persists independently of listening and microphone inclusion", () => {
  const legacy = restoreNativePreferences({ microphone: "fifine", systemAudio: true });
  expect(legacy.systemAudioDevice).toBe("default:multimedia");
  const next = nativePreferenceUpdate(legacy, { systemAudioDevice: "{synthetic-output}", autoListen: true, transcribeMicrophone: false });
  expect(restoreNativePreferences(JSON.parse(JSON.stringify(next)))).toMatchObject({ systemAudioDevice: "{synthetic-output}",
    systemAudio: true, autoListen: true, transcribeMicrophone: false, microphone: "fifine" });
  expect(legacy.systemAudioDevice).toBe("default:multimedia");
  for (const value of [null, 1, "", "invalid\u0000device", "x".repeat(513)])
    expect(() => nativePreferenceUpdate(legacy, { systemAudioDevice: value })).toThrow();
});
test("answer pause restores old profiles, persists independently and rejects unsafe durations", () => {
  const legacy = restoreNativePreferences({ microphone: "fifine", systemAudioDevice: "default:communications" });
  expect(legacy.answerPauseSeconds).toBe(1);
  for (const seconds of [0, 1, 4, 10, 15]) {
    const next = nativePreferenceUpdate(legacy, { answerPauseSeconds: seconds });
    expect(restoreNativePreferences(JSON.parse(JSON.stringify(next)))).toMatchObject({
      answerPauseSeconds: seconds, microphone: "fifine", systemAudioDevice: "default:communications" });
  }
  for (const value of [null, "4", -1, 16, 1.5, NaN, Infinity])
    expect(() => nativePreferenceUpdate(legacy, { answerPauseSeconds: value })).toThrow();
  expect(restoreNativePreferences({ answerPauseSeconds: -1 }).answerPauseSeconds).toBe(1);
  expect(legacy.answerPauseSeconds).toBe(1);
});
