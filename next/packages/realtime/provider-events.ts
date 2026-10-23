import { z } from "zod";
import type { ChannelState } from "./state.ts";
import { RealtimeError } from "./domain.ts";
const itemId = z.string().min(1).max(200);
const text = z
  .string()
  .max(512 * 1024)
  .transform((value) => value.slice(0, 16000));
const final = z.object({ item_id: itemId, transcript: text.default("") });
const committed = z.object({
  item_id: itemId,
  previous_item_id: itemId.nullable().optional(),
});
const delta = z.object({ item_id: itemId, delta: text.default("") });
const deepgram = z.object({
  start: z.number().finite().nonnegative().max(3600).optional(),
  duration: z.number().finite().nonnegative().max(3601).optional(),
  is_final: z.boolean().optional(),
  channel: z
    .object({
      alternatives: z.array(z.object({ transcript: text.optional() })).max(10),
    })
    .optional(),
});
export async function providerEvent(state: ChannelState, input: unknown) {
  if (typeof input !== "string" || Buffer.byteLength(input) > 1024 * 1024)
    throw new RealtimeError("realtime_invalid", 502);
  const value = z.record(z.string(), z.unknown()).parse(JSON.parse(input));
  if (
    value.type === "error" ||
    value.type === "Error" ||
    value.err_code ||
    value.type === "conversation.item.input_audio_transcription.failed"
  )
    throw new RealtimeError("realtime_invalid", 502);
  if (state.config?.deepgram) {
    if (value.type !== "Results") return;
    const event = deepgram.parse(value);
    const item = `deepgram:${event.start ?? 0}:${event.duration ?? "legacy"}`;
    const transcript = event.channel?.alternatives[0]?.transcript ?? "";
    if (event.is_final) {
      await state.turns.final(item, transcript);
      if (event.start !== undefined && event.duration !== undefined)
        state.drain.deepgramFinal(event.start, event.duration);
      state.notices();
    } else
      state.send({
        type: "delta",
        itemId: item,
        text: transcript,
        replace: true,
        who: state.ticket.who,
      });
    return;
  }
  switch (value.type) {
    case "session.updated":
      if (!state.ready) {
        state.ready = true;
        state.send({
          type: "ready",
          model: state.config?.model,
          supportsFlush: true,
        });
      }
      break;
    case "input_audio_buffer.committed": {
      const event = committed.parse(value);
      await state.turns.acknowledged(event.item_id, event.previous_item_id);
      state.notices();
      break;
    }
    case "conversation.item.input_audio_transcription.delta": {
      const event = delta.parse(value);
      const utteranceId = state.turns.utterance(event.item_id);
      state.send({
        type: "delta",
        itemId: event.item_id,
        text: event.delta,
        who: state.ticket.who,
        ...(utteranceId ? { utteranceId } : {}),
      });
      break;
    }
    case "conversation.item.input_audio_transcription.completed": {
      const event = final.parse(value);
      await state.turns.completed(event.item_id, event.transcript);
      state.notices();
      break;
    }
  }
}
