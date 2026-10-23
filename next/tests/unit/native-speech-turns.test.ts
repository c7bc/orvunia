import { expect, test } from "bun:test";
import { nativeRealtimeTurns } from "../support/native-realtime-turns.ts";
import { SpeechActivity } from "../../../client/audio/speech-activity.ts";

test("stationary subthreshold noise creates neither uploaded PCM nor confirmation debt", async () => {
  const fixture = await nativeRealtimeTurns();
  try {
    for (let frame = 0; frame < 500; frame++) fixture.frame(0, true);
    expect(fixture.packets).toHaveLength(0);
    expect(fixture.commands).toHaveLength(0);
    expect(fixture.state.confirmation.sent).toBe(0);
    expect(fixture.state.shutdownError).toBeNull();
    expect(fixture.activity.filter(event => !event.active)).toHaveLength(1);
  } finally { await fixture.close(); }
});

test("quiet speech keeps bounded pre-roll and tail and commits on silence without waiting three seconds", async () => {
  const fixture = await nativeRealtimeTurns();
  try {
    for (let frame = 0; frame < 50; frame++) fixture.frame(0, true);
    const expected: Uint8Array[] = [];
    for (let frame = 0; frame < 35; frame++) expected.push(fixture.frame(0.0003 * (1 + 0.5 * Math.sin(frame))));
    const lastSpeech = fixture.now();
    for (let frame = 0; frame < 31; frame++) fixture.frame(0);
    expect(fixture.commands.filter(command => command.type === "commit")).toHaveLength(1);
    expect(fixture.now() - lastSpeech).toBeLessThan(1000);
    const start = fixture.packets.findIndex(packet => packet.every((value, index) => value === expected[0]![index]));
    expect(start).toBeGreaterThanOrEqual(12);
    expect(fixture.packets.slice(start, start + expected.length)).toEqual(expected);
    expect(fixture.activity.some(event => event.active)).toBe(true);
    const quiet = fixture.activity.at(-1)!;
    expect(quiet.active).toBe(false);
    expect(quiet.at).toBeLessThanOrEqual(lastSpeech);
    const before = fixture.state.confirmation.sent;
    for (let frame = 0; frame < 30; frame++) fixture.frame(0, true);
    expect(fixture.state.confirmation.sent).toBe(before);
    expect(fixture.activity.at(-1)).toEqual(quiet);
  } finally { await fixture.close(); }
});

test("long speech checkpoints preserve utterance identity and the next utterance receives a new ID", async () => {
  const fixture = await nativeRealtimeTurns();
  try {
    for (let frame = 0; frame < 820; frame++) fixture.frame(0.003 * (1 + 0.5 * Math.sin(frame)));
    expect(fixture.commands.filter(command => command.type === "commit")).toHaveLength(1);
    for (let frame = 0; frame < 31; frame++) fixture.frame(0);
    const first = fixture.commands.filter(command => command.type === "commit");
    expect(first).toHaveLength(2);
    expect(first[0]!.utteranceId).toBe(first[1]!.utteranceId);
    for (let frame = 0; frame < 20; frame++) fixture.frame(0.001 * (1 + 0.5 * Math.sin(frame)));
    for (let frame = 0; frame < 31; frame++) fixture.frame(0);
    expect(fixture.commands.at(-1)!.utteranceId).not.toBe(first[0]!.utteranceId);
  } finally { await fixture.close(); }
});

test("a native endpoint that stops producing blocks closes its last turn once and stays listening", async () => {
  const fixture = await nativeRealtimeTurns();
  try {
    for (let frame = 0; frame < 20; frame++) fixture.frame(0.001 * (1 + 0.5 * Math.sin(frame)));
    fixture.advance(700); await Bun.sleep(120);
    expect(fixture.commands.filter(command => command.type === "commit")).toHaveLength(1);
    expect(fixture.state.running).toBe(true);
    expect(fixture.activity.at(-1)!.active).toBe(false);
    fixture.advance(700); await Bun.sleep(120);
    expect(fixture.commands.filter(command => command.type === "commit")).toHaveLength(1);
  } finally { await fixture.close(); }
});

test("stationary energy loses voice activity while an amplitude-varying low voice remains detectable", () => {
  const noise = new SpeechActivity(), voice = new SpeechActivity();
  for (let frame = 0; frame < 200; frame++) {
    noise.observe(0.00015, 20, frame * 20);
    voice.observe(0.00015 * (1 + 0.5 * Math.sin(frame)), 20, frame * 20);
  }
  expect(noise.active).toBe(false);
  expect(voice.active).toBe(true);
  expect(voice.threshold).toBeLessThan(0.0001);
});

test("low background energy formerly admitted by the amplitude fallback stays local", async () => {
  const fixture = await nativeRealtimeTurns();
  try {
    for (let frame = 0; frame < 500; frame++) fixture.frame(0.0005, true);
    await fixture.state.nativeCapture!.flush();
    expect(fixture.packets).toHaveLength(0);
    expect(fixture.commands).toHaveLength(0);
    expect(fixture.state.confirmation.sent).toBe(0);
  } finally { await fixture.close(); }
});

test("abandoned speech confirmations retain their original fixed deadline", async () => {
  const fixture = await nativeRealtimeTurns();
  try {
    for (let frame = 0; frame < 20; frame++) fixture.frame(0.001 * (1 + 0.5 * Math.sin(frame)));
    for (let frame = 0; frame < 31; frame++) fixture.frame(0, true);
    expect(fixture.commands.filter(command => command.type === "commit")).toHaveLength(1);
    const started = fixture.state.pendingSince!;
    fixture.advance(19_999 - (fixture.now() - started));
    expect(fixture.state.pendingError()).toBeNull();
    fixture.state.activity(true); fixture.state.markCommit();
    fixture.advance(1);
    expect(fixture.state.pendingSince).toBe(started);
    expect(fixture.state.pendingError()).toBeInstanceOf(Error);
    expect(fixture.state.shutdownError).toBeInstanceOf(Error);
  } finally { await fixture.close(); }
});

test("a manual flush checkpoints the current utterance without relabeling its later speech", async () => {
  const fixture = await nativeRealtimeTurns();
  try {
    for (let frame = 0; frame < 20; frame++) fixture.frame(0.001 * (1 + 0.5 * Math.sin(frame)));
    await fixture.state.nativeCapture!.flush();
    for (let frame = 0; frame < 20; frame++) fixture.frame(0.001 * (1 + 0.5 * Math.sin(frame)));
    for (let frame = 0; frame < 31; frame++) fixture.frame(0);
    expect(fixture.commands).toHaveLength(2);
    expect(fixture.commands[0]!.utteranceId).toBe(fixture.commands[1]!.utteranceId);
  } finally { await fixture.close(); }
});
