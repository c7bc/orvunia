import type { StudioAudio } from "./index.js";
import type { StudioSettings } from "./contracts.js";
import type { Transcript } from "../realtime/contracts.js";
import type { AudioStamp } from "./transcription.js";
export type ListeningPorts = {
  audio: Pick<StudioAudio, "running" | "start" | "stop">;
  current(): { id: string; state: string } | null;
  workspace(): string;
  blocked(): boolean;
  view(): string;
  settings(): Omit<StudioSettings, "sessionId" | "time"> & {
    systemAudio: boolean;
    autoListen?: boolean;
    transcribeMicrophone?: boolean;
  };
  context(): AudioStamp;
  clock(): number;
  duration(): number;
  format(seconds: number): string;
  began(sessionId: string, origin: number): void;
  state(kind: string, status: string, detail: unknown, sessionId: string): void;
  transcribe(
    blob: Blob,
    who: string,
    sessionId: string,
    stamp: AudioStamp,
  ): Promise<unknown>;
  transcript(value: Transcript, sessionId: string): void;
  partial(
    kind: string,
    item: string,
    text: string,
    done: boolean,
    sessionId: string,
    utteranceId?: string,
  ): void;
  hasSource(): boolean;
  nativeSystemAudio?(): boolean;
  chooseSource(): Promise<unknown>;
  broadcast(value: unknown): void;
  stopped(): void;
  render(): void;
  toast(message: string): void;
  translate(message: string): string;
};
