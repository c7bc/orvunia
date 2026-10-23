import type { ChannelState } from "./state.ts";
import { RealtimeError } from "./domain.ts";
import { assertLive } from "./guard.ts";
export async function forwardPcm(state: ChannelState, data: Uint8Array) {
  const { dependencies, ticket, upstream, config } = state;
  if (!upstream || !config) throw new RealtimeError("realtime_starting");
  const before = Math.ceil(state.totalBytes / 48000);
  const added =
    Math.ceil((state.totalBytes + data.byteLength) / 48000) - before;
  const reservation = added
    ? await dependencies.usage.reserve(
        ticket.workspaceId,
        "transcriptionSeconds",
        added,
        `live:${ticket.id}:${before}`,
      )
    : null;
  let invoked = false;
  try {
    await assertLive(state);
    if (!upstream.open() || upstream.bufferedBytes() > 480000)
      throw new RealtimeError("realtime_closed");
    invoked = true;
    if (config.deepgram) upstream.send(data);
    else
      state.forward({
        type: "input_audio_buffer.append",
        audio: Buffer.from(data).toString("base64"),
      });
    state.totalBytes += data.byteLength;
    state.turnBytes += data.byteLength;
    state.drain.append(data.byteLength);
    if (reservation)
      await dependencies.usage.commit(
        ticket.workspaceId,
        reservation.id,
        added,
        {
          model: config.model,
          inputTokens: null,
          outputTokens: null,
          priceVersion: null,
          source: "duration",
        },
      );
  } catch (error) {
    if (reservation) {
      try {
        if (invoked)
          await dependencies.usage.unknown(ticket.workspaceId, reservation.id);
        else
          await dependencies.usage.release(
            ticket.workspaceId,
            reservation.id,
            true,
          );
      } catch {
        dependencies.log({
          event: "realtime_usage_pending",
          channelId: ticket.id,
        });
      }
    }
    throw error;
  }
}
