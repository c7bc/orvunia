import type { ApplicationState } from "./model.js";
import type { ApplicationRequest } from "./request.js";
import type { StudioAudio } from "../studio/index.js";
import type { Transcript } from "../realtime/contracts.js";
export type ApplicationAudioPorts = {
  state: Pick<
    ApplicationState,
    | "current"
    | "workspaceKey"
    | "audioSessionId"
    | "audioTimeOrigin"
    | "prefs"
    | "desktop"
    | "health"
    | "voiceActivity"
    | "partialTranscripts"
    | "audioStatus"
    | "audioProgress"
    | "audioPending"
    | "source"
    | "view"
  >;
  document: Document;
  audio: Pick<StudioAudio, "running" | "start" | "stop">;
  request: ApplicationRequest;
  clock(): number;
  duration(): number;
  format(seconds: number): string;
  identifier(): string;
  accept(value: Transcript, sessionId: string): void;
  partial(
    kind: string,
    item: string,
    text: string,
    done: boolean,
    sessionId: string,
    utteranceId?: string,
  ): void;
  chooseSource(): Promise<unknown>;
  nativeSystemAudio?(): boolean;
  broadcast(value: unknown): void;
  refreshActivity(): void;
  resumeAutomatic?(): void;
  label(): string;
  render(): void;
  toast(message: string): void;
  translate(message: string): string;
};
