export type DiagnosticState = {
  status: "idle" | "requesting" | "listening" | "stopped" | "error";
  level: number;
  reason: string | null;
  deviceId: string;
};
export type DiagnosticClock = {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(identifier: number): void;
  now(): number;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(identifier: number): void;
};
export type DiagnosticFailure = Error & { code: string };
export type DiagnosticOptions = {
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  AudioContext?: typeof AudioContext;
  onLevel?(level: number, details: { rms: number; elapsedMs: number }): void;
  onState?(state: Readonly<DiagnosticState>): void;
  onError?(error: DiagnosticFailure): void;
  timeoutMs?: number;
  clock?: Partial<DiagnosticClock>;
  lifecycle?: Pick<Window, "addEventListener" | "removeEventListener">;
};
export type DiagnosticResources = {
  stream: MediaStream | null;
  context: AudioContext | null;
  source: MediaStreamAudioSourceNode | null;
  analyser: AnalyserNode | null;
  frame: number | null;
  timer: number | null;
  abort: (() => void) | null;
  ended: [MediaStreamTrack, EventListener][];
};
