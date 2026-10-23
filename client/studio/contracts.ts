import type {
  ChunkCallback,
  StateCallback,
  RecorderOptions,
  BoundaryOptions,
} from "../audio/contracts.js";
import type { FinalCallback, RealtimeOptions } from "../realtime/contracts.js";
export type AudioChannel = {
  running: boolean;
  queued?: number;
  error?: Error | null;
  readonly shutdownError?: Error | null;
  stop(): Promise<void>;
  flush(options?: BoundaryOptions): Promise<void>;
};
export type ChunkChannel = AudioChannel & {
  start(
    source: string,
    chunk: ChunkCallback,
    state: StateCallback,
    options: RecorderOptions,
  ): Promise<void>;
};
export type RealtimeChannel = AudioChannel & {
  start(
    source: string,
    final: FinalCallback,
    state: StateCallback,
    options: RealtimeOptions,
  ): Promise<void>;
};
export type StudioPlatform = {
  chunk(source?: string): ChunkChannel;
  realtime(): RealtimeChannel;
  wave(blob: Blob): Promise<Blob>;
};
export type StudioSettings = {
  realtime: boolean;
  sessionId: string;
  time(): string;
  chunkSeconds?: number;
  microphone?: string;
  systemAudioDevice?: string;
  pcmChunks?: boolean;
};
export type StudioCallbacks = {
  chunk(blob: Blob, speaker: string): void | Promise<void>;
  state(kind: string, state: string, detail?: unknown): void;
  transcript: FinalCallback;
  partial?: (kind: string, item: string, text: string, done: boolean, utteranceId?: string) => void;
};
