import { z } from "zod";
import type { ChannelState } from "./state.ts";
import { RealtimeError } from "./domain.ts";
import { assertLive } from "./guard.ts";
import { forwardPcm } from "./metering.ts";
const command = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("commit"),
      time: z.string().regex(/^\d{2,3}:\d{2}$/),
      utteranceId: z.uuid().optional(),
    })
    .strict(),
  z.object({ type: z.literal("flush"), id: z.uuid() }).strict(),
  z.object({ type: z.literal("ping") }).strict(),
]);
function commit(state: ChannelState, force = false) {
  if (!state.turnBytes || (!force && state.turnBytes < 4800)) return true;
  const deepgram = state.config?.deepgram;
  const padding = deepgram ? 0 : Math.max(0, 4800 - state.turnBytes);
  if (state.paddingBytes + padding > Math.max(4800, state.totalBytes))
    return false;
  if (padding) {
    state.paddingBytes += padding;
    state.forward({
      type: "input_audio_buffer.append",
      audio: Buffer.alloc(padding).toString("base64"),
    });
  }
  state.drain.commit();
  state.turnBytes = 0;
  if (!deepgram) state.turns.commit(state.pendingUtteranceId);
  state.pendingUtteranceId = undefined;
  state.forward({ type: deepgram ? "Finalize" : "input_audio_buffer.commit" });
  return true;
}
export async function clientInput(state: ChannelState, value: unknown) {
  if (!state.ready || !state.upstream?.open())
    throw new RealtimeError("realtime_starting");
  await assertLive(state);
  if (value instanceof Uint8Array) {
    if (state.dependencies.clock() - state.windowStarted >= 1000) {
      state.windowStarted = state.dependencies.clock();
      state.windowBytes = 0;
    }
    state.windowBytes += value.byteLength;
    if (
      !value.byteLength ||
      value.byteLength > 32000 ||
      value.byteLength % 2 ||
      state.windowBytes > 150000 ||
      state.turnBytes + value.byteLength > 48000 * 60
    )
      throw new RealtimeError("realtime_limit", 429);
    await forwardPcm(state, value);
    return;
  }
  if (JSON.stringify(value)?.length > 4096)
    throw new RealtimeError("realtime_invalid", 400);
  const input = command.parse(
    typeof value === "string" ? JSON.parse(value) : value,
  );
  if (input.type === "commit") {
    state.latestTime = input.time;
    state.pendingUtteranceId = state.turnBytes ? input.utteranceId : undefined;
    commit(state);
  }
  if (input.type === "flush") {
    if (state.config?.deepgram) {
      if (state.turnBytes) {
        state.drain.commit();
        state.turnBytes = 0;
      }
      if (state.drain.confirmedBytes < state.drain.bytes)
        state.forward({ type: "Finalize" });
    } else if (!commit(state, true)) {
      state.send({ type: "flush-error", id: input.id, code: "realtime_short" });
      return;
    }
    for (const notice of state.drain.flush(input.id)) state.send(notice);
  }
}
