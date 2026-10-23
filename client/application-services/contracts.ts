import type { ApplicationState } from "../application/model.js";
import type { NativeGaze } from "../gaze/runtime.js";
import type { createGazeController } from "../gaze/index.js";
import type { ApplicationEdition } from "./edition.js";
import type { SettingsPort } from "./edition.js";
import type { createCalendarController } from "../calendar/controller.js";
import type { bindProviderSettings } from "../providers/bind.js";
import type { renderProviderSettings } from "../providers/render.js";
export type ApplicationRequest = (
  path: string,
  method?: string,
  body?: unknown,
) => Promise<unknown>;
export type ApplicationModal = (
  title: string,
  content: string,
  className?: string,
) => void;
export type ApplicationButton = (
  label: string,
  action: string,
  style?: string,
  icon?: string,
) => string;
export type ApplicationTranslate = (
  text: string,
  parameters?: Record<string, string | number>,
) => string;
export type ConnectionPorts = {
  state: ApplicationState;
  advanced?: SettingsPort;
  managed?: SettingsPort;
  document: Document;
  native:
    (NativeGaze & { openExternal?(url: string): Promise<unknown> }) | null;
  factories: {
    gaze: typeof createGazeController;
    welcome: ApplicationEdition["welcome"];
    billing?: ApplicationEdition["billing"];
    usageView: ApplicationEdition["usageView"];
    calendar: typeof createCalendarController;
  };
  request: ApplicationRequest;
  identifier(): string;
  sync(): Promise<unknown>;
  initialize(): Promise<unknown>;
  begin(mode: string, title: string): Promise<unknown>;
  navigate(url: string): void;
  toast(message: string): void;
  translateUI(root: HTMLElement | null): void;
  escape(value: unknown): string;
  render(): void;
  modal: ApplicationModal;
  renderProviders: typeof renderProviderSettings;
  bindProviders: typeof bindProviderSettings;
};
