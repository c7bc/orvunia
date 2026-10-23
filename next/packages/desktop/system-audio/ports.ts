import type { HelperEvent, SystemAudioCatalog } from "./contracts.ts";

export type HelperProcess = {
  command(value: Record<string, unknown>): boolean;
  endInput(): void;
  terminate(): void;
  closed: Promise<number | null>;
};
export type HelperEvents = {
  data(value: Uint8Array): void;
  metadata(value: unknown): void;
  exited(code: number | null): void;
};
export type LaunchHelper = (action: "enumerate" | "capture", events: HelperEvents) => HelperProcess;
export type SystemAudioEvent =
  | { type: "pcm"; captureId: string; sequence: number; data: Uint8Array; rms: number; peak: number }
  | { type: "ended"; captureId: string }
  | { type: "error"; captureId: string; code: string };
export type CaptureOwner = { senderId: number; sessionId: string };
export type SystemAudioPorts = {
  supported(): boolean;
  allowed(owner: CaptureOwner): boolean;
  enumerate(): Promise<SystemAudioCatalog>;
  launch: LaunchHelper;
  event(owner: CaptureOwner, event: SystemAudioEvent): void;
};
export type CaptureMetadata = Extract<HelperEvent, { event: "ready" }>;
export class SystemAudioError extends Error {
  constructor(readonly code: string) { super(code); }
}
