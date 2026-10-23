import type { StateCallback } from "../audio/contracts";
import type { NativeAudioBridge } from "../system-audio/bridge.js";
export type Transcript = {
  id: string;
  text: string;
  who: string;
  time: string;
  source: string;
  segmentId?: string;
  utteranceId?: string;
};
export type FinalCallback = (transcript: Transcript) => void | Promise<void>;
export type RealtimeOptions = {
  sessionId: string;
  device?: string;
  time(): string;
  onPartial?: (item: string, text: string, done: boolean, utteranceId?: string) => void;
};
export type RealtimePlatform = {
  native?: NativeAudioBridge;
  request(input: string, options: RequestInit): Promise<Response>;
  socket(ticket: string): WebSocket;
  acquire(source: string, device?: string): Promise<MediaStream>;
  context(): AudioContext;
  stream(tracks: MediaStreamTrack[]): MediaStream;
  processor(context: AudioContext, source?: string): AudioWorkletNode;
  open(socket: WebSocket | undefined): boolean;
  clock(): number;
  identifier(): string;
};
export type Waiter = { resolve(): void; reject(error: unknown): void };
export type RealtimeStateCallback = StateCallback;
