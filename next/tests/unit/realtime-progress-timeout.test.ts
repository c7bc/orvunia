import { expect, test } from "bun:test";
import { RealtimeAudio } from "../../../client/realtime/recorder.ts";
import { connect } from "../../../client/realtime/connection.ts";
import type { RealtimePlatform } from "../../../client/realtime/contracts.ts";

async function fixture() {
  let at = 10_000;
  const socket = { onmessage: null as null | ((event: { data: string }) => void), close() {} };
  const message = (value: unknown) => socket.onmessage?.({ data: JSON.stringify(value) });
  const forbidden = () => { throw Error("No hardware or network"); };
  const platform: RealtimePlatform = { request: async () => Response.json({ ticket: "controlled" }),
    socket: () => { queueMicrotask(() => message({ type: "ready", supportsFlush: true })); return socket as unknown as WebSocket; },
    acquire: forbidden, context: forbidden, stream: forbidden, processor: forbidden,
    open: () => true, clock: () => at, identifier: () => crypto.randomUUID() };
  const state = new RealtimeAudio(platform);
  await connect(state, "display", () => {}, () => {}, { sessionId: crypto.randomUUID(), time: () => "00:01" });
  return { state, message, advance(milliseconds: number) { at += milliseconds; } };
}
test("confirming an earlier turn advances the deadline to the next pending turn's own commit time", async () => {
  const sample = await fixture();
  sample.state.markCommit();
  sample.advance(15_000); sample.state.markCommit();
  sample.advance(3000); sample.message({ type: "final", itemId: "first" });
  await sample.state.deliveries;
  sample.advance(3000);
  expect(sample.state.pending).toBe(1);
  expect(sample.state.pendingError()).toBeNull();
  sample.advance(14_000);
  expect(sample.state.pendingError()).toBeInstanceOf(Error);
});
test("new commits and speech cannot extend the deadline of an unconfirmed earlier turn", async () => {
  const sample = await fixture();
  sample.state.markCommit(); sample.advance(19_999); sample.state.markCommit(); sample.advance(1);
  expect(sample.state.pendingError()).toBeInstanceOf(Error);
});
