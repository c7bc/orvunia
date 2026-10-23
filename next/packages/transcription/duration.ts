import { TranscriptionError } from "./domain.ts";

export function pcmDuration(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const label = (offset: number) =>
    String.fromCharCode(...data.subarray(offset, offset + 4));
  if (data.length < 44 || label(0) !== "RIFF" || label(8) !== "WAVE")
    throw new TranscriptionError("invalid_audio", 415);
  if (view.getUint32(4, true) + 8 !== data.length)
    throw new TranscriptionError("invalid_audio", 400);
  let rate = 0,
    channels = 0,
    bytes = 0,
    formatFound = false,
    chunks = 0,
    cursor = 12;
  while (cursor < data.length) {
    if (++chunks > 256 || cursor + 8 > data.length)
      throw new TranscriptionError("invalid_audio", 400);
    const kind = label(cursor),
      size = view.getUint32(cursor + 4, true),
      begin = cursor + 8;
    if (begin + size + (size % 2) > data.length)
      throw new TranscriptionError("invalid_audio", 400);
    if (kind === "fmt ") {
      if (formatFound || size < 16)
        throw new TranscriptionError("invalid_audio", 400);
      formatFound = true;
      const format = view.getUint16(begin, true),
        bits = view.getUint16(begin + 14, true);
      channels = view.getUint16(begin + 2, true);
      rate = view.getUint32(begin + 4, true);
      if (
        format !== 1 ||
        bits !== 16 ||
        ![1, 2].includes(channels) ||
        ![16000, 24000, 44100, 48000].includes(rate) ||
        view.getUint16(begin + 12, true) !== channels * 2 ||
        view.getUint32(begin + 8, true) !== rate * channels * 2
      )
        throw new TranscriptionError("invalid_audio", 415);
    }
    if (kind === "data") bytes += size;
    cursor = begin + size + (size % 2);
  }
  if (!formatFound || !bytes || bytes % (channels * 2))
    throw new TranscriptionError("invalid_audio", 415);
  const seconds = bytes / (rate * channels * 2);
  if (seconds > 12) throw new TranscriptionError("audio_duration_limit", 413);
  return Math.max(1, Math.ceil(seconds));
}
