import type { CommandContext, CommandPorts } from "./ports.js";
export interface CommandEventPorts extends CommandPorts {
  clock(): number;
  workspace(): string;
  identifier(): string;
  duration(): number;
  time(seconds: number): string;
  values(form: HTMLFormElement): Record<string, string>;
  setLocale(locale: string): unknown;
  modeBase(id: string): "recruiter" | "technical";
  startSession(mode: string): Promise<unknown>;
  startAudio(): Promise<unknown>;
  capture(sourceId: string, shouldCrop?: boolean): Promise<unknown>;
  autosizeQuestion(): void;
  updateOverlaySize(): void;
  filteredSessions(): string;
  updateSearchResults(query: string): void;
  saveSessionTitle(field: HTMLInputElement): Promise<unknown>;
  saveFollowup(form: HTMLFormElement): Promise<boolean>;
}
export type CommandEventContext = Omit<CommandContext, "ports"> & {
  ports: CommandEventPorts;
};
export interface CommandEvents {
  settle():Promise<void>;
  on<Key extends keyof DocumentEventMap>(
    name: Key,
    callback: (event: DocumentEventMap[Key]) => void | Promise<void>,
  ): void;
  active(): boolean;
  dispose(): void;
}
export function datasetValue(value: string | undefined): string {
  if (value === undefined)
    throw Error("Esta opção não está mais disponível. Abra a tela novamente.");
  return value;
}
export function commandError(error: unknown): string {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "Não foi possível concluir a operação.";
}
