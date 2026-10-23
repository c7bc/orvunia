import type { BrowserStorageSession } from "./browser-storage-types.ts";
import type { NativeSession } from "./session.ts";
import type {
  NativePermissionSession,
  NativeNavigationContents,
  NativeFrame,
} from "./security-types.ts";
import type { NativeCaptureSource } from "./native-capture.ts";
import type { WindowBounds } from "./gaze-types.ts";
export type NativeCookies = {
  get(options: {
    url: string;
    name?: string;
  }): Promise<(Record<string, unknown> & { value: string })[]>;
  set(options: {
    url: string;
    name: string;
    value: string;
    path: string;
    httpOnly: boolean;
    secure?: boolean;
    sameSite: "lax" | "strict";
    expirationDate?: number;
  }): Promise<void>;
  flushStore(): Promise<void>;
};
export interface PlatformSession
  extends
    BrowserStorageSession,
    NativeSession,
    NativePermissionSession<NativeCaptureSource> {
  cookies: NativeCookies;
  fetch(url: string, options?: RequestInit): Promise<Response>;
  clearStorageData(options: {
    origin: string;
    storages: string[];
  }): Promise<void>;
}
export interface PlatformContents extends NativeNavigationContents {
  id: number;
  mainFrame: NativeFrame;
  session: PlatformSession;
  isDestroyed(): boolean;
  getURL(): string;
  send(channel: string, data: unknown): void;
  executeJavaScript(script: string): Promise<unknown>;
  reload(): void;
  capturePage(
    bounds: undefined,
    options: { stayHidden: boolean; stayAwake: boolean },
  ): Promise<{ toPNG(): Buffer }>;
  getLastWebPreferences(): { contextIsolation: boolean; sandbox: boolean };
  getZoomFactor(): number;
  on(
    event: "will-navigate" | "will-redirect",
    listener: (request: { preventDefault(): void }, url: string) => void,
  ): void;
  on(
    event: "will-frame-navigate",
    listener: (request: { preventDefault(): void; url: string }) => void,
  ): void;
  on(event: "render-process-gone", listener: () => void): void;
  on(
    event: "did-start-navigation",
    listener: (
      request: unknown,
      url: string,
      inPlace: boolean,
      mainFrame: boolean,
    ) => void,
  ): void;
}
export type NativeWindowOptions = Record<string, unknown>;
export type PlatformWindow = {
  webContents: PlatformContents;
  isDestroyed(): boolean;
  isVisible(): boolean;
  isFocused(): boolean;
  isFocusable(): boolean;
  isMaximized(): boolean;
  isAlwaysOnTop(): boolean;
  isContentProtected(): boolean;
  hide(): void;
  show(): void;
  showInactive(): void;
  destroy(): void;
  minimize(): void;
  maximize(): void;
  unmaximize(): void;
  getBounds(): WindowBounds;
  getContentSize(): number[];
  getOpacity(): number;
  getNativeWindowHandle(): Buffer;
  getMediaSourceId(): string;
  setPosition(x: number, y: number): void;
  setContentSize(width: number, height: number): void;
  setContentProtection(enabled: boolean): void;
  setFocusable(enabled: boolean): void;
  setAlwaysOnTop(enabled: boolean, level?: string): void;
  setSkipTaskbar(enabled: boolean): void;
  setOpacity(value: number): void;
  setIgnoreMouseEvents(enabled: boolean, options: { forward: boolean }): void;
  loadURL(url: string): Promise<void>;
  on(
    event: "page-title-updated" | "close",
    listener: (request: { preventDefault(): void }) => void,
  ): void;
  on(
    event: "move" | "resize" | "moved" | "resized" | "maximize" | "hide",
    listener: () => void,
  ): void;
  on(
    event: "will-resize",
    listener: (request: { preventDefault(): void }) => void,
  ): void;
  once(event: "ready-to-show", listener: () => void): void;
};
export type PlatformTray = {
  setContextMenu(menu: unknown): void;
  setToolTip(text: string): void;
  on(event: "click", listener: () => void): void;
  destroy(): void;
};
