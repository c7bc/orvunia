import type { WindowBounds } from "./gaze-types.ts";
export type ShortcutName =
  | "toggle"
  | "ask"
  | "capture"
  | "clear"
  | "camera"
  | "cursor"
  | "clickthrough"
  | "up"
  | "down"
  | "left"
  | "right"
  | "scrollUp"
  | "scrollDown"
  | "pause";
export type NativePreferences = Record<string, unknown> & {
  protected: boolean;
  noFocus: boolean;
  clickthrough: boolean;
  opacity: number;
  theme: "system" | "light" | "dark";
  uiLocale: "pt-BR" | "en" | "es";
  launchAtLogin: boolean;
  shortcuts: Record<ShortcutName, string>;
  bounds: WindowBounds | null;
  microphone: string;
  systemAudioDevice: string;
  systemAudio: boolean;
  autoListen: boolean;
  transcribeMicrophone: boolean;
  autoAnswer: boolean;
  answerPauseSeconds: number;
  autoScreen: boolean;
  ambientChat: boolean;
  realtime: boolean;
  chunkSeconds: 3 | 5 | 8;
  visualRevision: number;
};
