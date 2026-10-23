import type { ApplicationState } from "../application/model.js";
import type { PanelSession, ModeBase } from "../panel/data.js";
import type { NoteState } from "../notes/contracts.js";

export type ExportNote = {
  session: string;
  text: string | undefined;
  revision: number;
  updatedAt?: string | null;
  pending?: boolean;
};
export interface ExportPorts {
  state: Pick<
    ApplicationState,
    "sessions" | "profile" | "prefs" | "library" | "agenda"
  >;
  workspace(): string;
  clock(): Date;
  notes: {
    flush(
      id: string,
    ): Promise<
      | Pick<
          NoteState,
          "dirty" | "conflict" | "error" | "revision" | "updatedAt"
        >
      | null
      | undefined
    >;
    value(id: string): string | undefined;
  };
  savedNotes(id: string): Promise<{ text: string; revision: number }>;
  session(id: string): Promise<PanelSession>;
  allNotes(): Promise<{ notes: ExportNote[] }>;
  allSessions(): Promise<unknown>;
  native: {
    export(value: { name: string; text: string }): Promise<{ saved?: boolean }>;
  } | null;
  download(name: string, text: string, type: string, lifetime: number): void;
  date(value: string): string;
  modeName(value: string | undefined): string;
  time(value: number): string;
  actionTitle(value: string, mode?: ModeBase): string;
  translate(value: string): string;
  toast(value: string): void;
}
export function exportOwnership(ports: ExportPorts) {
  const workspace = ports.workspace();
  return () => {
    if (ports.workspace() !== workspace)
      throw new DOMException(
        "O espaço mudou durante a exportação.",
        "AbortError",
      );
  };
}
