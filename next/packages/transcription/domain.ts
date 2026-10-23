export type RecordedAudio = {
  data: Uint8Array;
  name: string;
  mime: string;
  segmentId: string;
  who: string;
  time: string;
  language?: string;
};
export class TranscriptionError extends Error {
  constructor(
    readonly code: "invalid_audio" | "audio_duration_limit",
    readonly status: number,
  ) {
    super(code);
  }
}
