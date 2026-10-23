import { applicationDesktop } from "./desktop-state.js";
import type { NativeApplicationEvent } from "./events-contracts.js";
import { array, record, text } from "../legacy-web/validation.js";
import type { CommandSettings } from "../commands/model.js";
import type { Point } from "../gaze/contracts.js";

type NativeMethod =
  | "state"
  | "motionComplete"
  | "flushComplete"
  | "layout"
  | "settings"
  | "shortcutReset"
  | "panel"
  | "overlay"
  | "begin"
  | "end"
  | "toggle"
  | "position"
  | "sources"
  | "source"
  | "capture"
  | "clipboard"
  | "quit"
  | "hide"
  | "minimize"
  | "maximize"
  | "export"
  | "import"
  | "reminders"
  | "openExternal"
  | "openUpdate"
  | "chatVisibility"
  | "gaze";
export type RawNative = Record<
  NativeMethod,
  (value?: unknown) => Promise<unknown>
> & {
  auxiliary?: (value: unknown) => Promise<unknown>;
  onAuxiliary?: (callback: (value: unknown) => void) => () => void;
  copy?: (value: string) => Promise<unknown>;
  openSupportReport?: (value: { body: string }) => Promise<unknown>;
  modelImport?: (value: { requestId: string; catalogId: string; revision: string }) => Promise<unknown>;
  repository?: (value: unknown) => Promise<unknown>;
  systemAudio?: (value: unknown) => Promise<unknown>;
  onEvent(callback: (event: unknown) => void): () => void;
};
export type NativeSource = { id: string; name: string; image: string };
function source(value: unknown): NativeSource {
  const item = record(value);
  return {
    ...item,
    id: text(item.id),
    name: text(item.name),
    image: text(item.image),
  };
}
function exported(value: unknown) {
  const item = record(value);
  for (const key of ["saved", "canceled"])
    if (item[key] !== undefined && typeof item[key] !== "boolean")
      throw Error("Resultado nativo inválido.");
  return {
    ...item,
    ...(typeof item.saved === "boolean" ? { saved: item.saved } : {}),
    ...(typeof item.canceled === "boolean" ? { canceled: item.canceled } : {}),
  };
}
function event(value: unknown): NativeApplicationEvent | null {
  const item = record(value),
    data = item.data;
  if (item.type === "state")
    return { type: item.type, data: applicationDesktop(data) };
  if (item.type === "session")
    return {
      type: item.type,
      data:
        data === null ? null : { ...record(data), id: text(record(data).id) },
    };
  if (item.type === "navigate" || item.type === "shortcut")
    return { type: item.type, data: text(data) };
  if (item.type === "quit-cancelled") return { type: item.type, data };
  if (item.type === "prepare-quit")
    return { type: item.type, data: { ticket: text(record(data).ticket) } };
  if (item.type === "window-motion") {
    const input = record(data);
    if (input.phase !== "enter" && input.phase !== "exit")
      throw Error("Transição nativa inválida.");
    return {
      type: item.type,
      data: {
        phase: input.phase,
        ...(input.ticket === undefined ? {} : { ticket: text(input.ticket) }),
      },
    };
  }
  return null;
}
export function createApplicationNative(
  raw: RawNative | null,
  onError: (message: string) => void,
) {
  if (!raw) return null;
  const importModel = raw.modelImport;
  return {
    ...(raw.auxiliary && raw.onAuxiliary ? { auxiliary: {
      invoke: raw.auxiliary.bind(raw), onEvent: raw.onAuxiliary.bind(raw),
    } } : {}),
    ...(raw.repository ? { repository: raw.repository.bind(raw) } : {}),
    ...(raw.systemAudio ? { systemAudio: raw.systemAudio.bind(raw) } : {}),
    ...(importModel ? { modelImport: (value: { requestId: string; catalogId: string; revision: string }) => importModel(value) } : {}),
    state: async (value?: unknown) =>
      applicationDesktop(await raw.state(value)),
    settings: async (value: Partial<CommandSettings>) =>
      applicationDesktop(await raw.settings(value)),
    shortcutReset: async (value: string) =>
      applicationDesktop(await raw.shortcutReset(value)),
    chatVisibility: async (value: boolean) =>
      applicationDesktop(await raw.chatVisibility(value)),
    sources: async () => array(await raw.sources(), source),
    capture: async (value: string) => {
      const item = record(await raw.capture(value));
      return { ...item, image: text(item.image), name: text(item.name) };
    },
    clipboard: async () => text(await raw.clipboard()),
    ...(raw.copy ? { copy: (value: string) => raw.copy!(value) } : {}),
    import: async () =>
      array(await raw.import(), (value) => {
        const item = record(value);
        return { ...item, name: text(item.name), text: text(item.text) };
      }),
    export: async (value: { name: string; text: string }) =>
      exported(await raw.export(value)),
    motionComplete: (value: string) => raw.motionComplete(value),
    flushComplete: (value: { ticket: string; ok: boolean }) =>
      raw.flushComplete(value),
    layout: (value: { height: number }) => raw.layout(value),
    panel: (value: string) => raw.panel(value),
    overlay: () => raw.overlay(),
    begin: (value: { id: string; mode: string }) => raw.begin(value),
    end: () => raw.end(),
    toggle: () => raw.toggle(),
    position: (value: string) => raw.position(value),
    source: (value: string) => raw.source(value),
    quit: () => raw.quit(),
    hide: () => raw.hide(),
    minimize: () => raw.minimize(),
    maximize: () => raw.maximize(),
    reminders: (value: unknown) => raw.reminders(value),
    openExternal: (url: string) => raw.openExternal(url),
    ...(raw.openSupportReport ? { openSupportReport: (value: { body: string }) => raw.openSupportReport!(value) } : {}),
    openUpdate: (url: string) => raw.openUpdate(url),
    gaze: (value: { enabled: boolean } | Point) => raw.gaze(value),
    onEvent(
      callback: (value: NativeApplicationEvent) => void | Promise<unknown>,
    ) {
      return raw.onEvent((value) => {
        try {
          const parsed = event(value);
          if (parsed)
            void Promise.resolve(callback(parsed)).catch((error) =>
              onError(
                error instanceof Error
                  ? error.message
                  : "Evento nativo inválido.",
              ),
            );
        } catch (error) {
          onError(
            error instanceof Error ? error.message : "Evento nativo inválido.",
          );
        }
      });
    },
  };
}
export type ApplicationNative = NonNullable<
  ReturnType<typeof createApplicationNative>
>;
