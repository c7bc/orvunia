import type { RecordedAudio } from "./domain.ts";
import { TranscriptionError } from "./domain.ts";
const formats = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
  "video/webm",
  "video/mp4",
  "audio/ogg",
  "audio/flac",
]);
export function validateRecordedAudio(input: RecordedAudio) {
  if (
    !input.data.length ||
    input.data.length > 25 * 1024 * 1024 ||
    !formats.has(input.mime)
  )
    throw new TranscriptionError(
      "invalid_audio",
      input.data.length > 25 * 1024 * 1024 ? 413 : 415,
    );
}
