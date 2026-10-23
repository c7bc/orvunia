export type RecorderOptions = { seconds?: number; device?: string; sessionId?: string };
export type BoundaryOptions = { signal?: AbortSignal; timeoutMs?: number };
export type ChunkCallback = (chunk: Blob) => void | Promise<void>;
export type StateCallback = (state: string, detail?: unknown) => void;
export type AudioPlatform = {
  available(): boolean;
  displayAvailable(): boolean;
  display(): Promise<MediaStream>;
  microphone(device?: string): Promise<MediaStream>;
  stream(tracks: MediaStreamTrack[]): MediaStream;
  format(): string | undefined;
  context(): AudioContext;
  recorder(stream: MediaStream, mime: string): MediaRecorder;
  clock(): number;
};
export function audioFailure(error: unknown): Error {
  if (error instanceof Error) return error;
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);
  return Error(message);
}
