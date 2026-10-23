import type { ApplicationDesktop, ApplicationState } from "./model.js";
import type { CommandSession } from "../commands/model.js";
import type { PanelTranscript } from "../panel/data.js";

export type NativeApplicationEvent =
  | { type: "prepare-quit"; data: { ticket: string } }
  | { type: "quit-cancelled"; data: unknown }
  | {
      type: "window-motion";
      data: { phase: "enter" | "exit"; ticket?: string };
    }
  | { type: "state"; data: ApplicationDesktop }
  | { type: "navigate"; data: string }
  | { type: "session"; data: { id: string } | null }
  | { type: "shortcut"; data: string };

export type ApplicationEventPorts = {
  state: ApplicationState;
  document: Document;
  clock(): number;
  workspace(): string;
  render(): void;
  sync(): Promise<unknown>;
  syncSession(sessionId: string): Promise<unknown>;
  toast(message: string): void;
  listen(): Promise<unknown>;
  ask(action: string): Promise<unknown>;
  end(): Promise<unknown>;
  refreshActivity(): void;
  cancelPrepared(): void;
  acceptTranscript(
    transcript: PanelTranscript,
    sessionId: string,
    broadcast: boolean,
  ): void;
  partialTranscript(
    kind: string,
    item: string,
    text: string,
    done: boolean,
    sessionId: string,
    remote: boolean,
    relativeMs: number,
    utteranceId?: string,
  ): void;
};
export type NativeEventPorts = ApplicationEventPorts & {
  resumeAutomatic?(): void;
  shutdown: { prepare(): Promise<boolean>; cancel(): void; active(): boolean };
  native: {
    flushComplete(value: { ticket: string; ok: boolean }): Promise<unknown>;
    reminders(agenda: ApplicationState["agenda"]): Promise<unknown>;
    motionComplete(ticket: string): Promise<unknown>;
  };
  motion: {
    play(phase: "enter" | "exit"): Promise<boolean>;
    exiting(): boolean;
  };
  locale(): string;
  setLocale(locale: string, options: { notify: false }): unknown;
  gaze: { status(): { nativeEnabled: boolean }; stop(): void };
  lifecycle: { reset(): void };
  listening: {
    select(sessionId: string | null): Promise<unknown>;
    automatic?(sessionId: string): Promise<unknown>;
    configure?(): Promise<unknown>;
  };
  session(id: string): Promise<CommandSession>;
  prepareRepository?(sessionId: string): Promise<boolean>;
  capture(sourceId: string, crop: boolean): Promise<unknown>;
  chooseSource(): Promise<unknown>;
  clear(): void;
  pause(): Promise<unknown>;
};

export function eventFailure(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir.";
}
