import type {
  PlatformWindow,
  PlatformContents,
  PlatformSession,
  PlatformTray,
  NativeWindowOptions,
} from "./platform-window.ts";
import type {
  NativeCaptureOptions,
  NativeCaptureSource,
} from "./native-capture.ts";
import type { NativeSecretStorage } from "./native-vault.ts";
import type { WindowBounds, GazePoint } from "./gaze-types.ts";
export type PlatformInvocation = {
  sender: PlatformContents;
  senderFrame: PlatformContents["mainFrame"] | null;
};
type MenuItem = { label?: string; type?: "separator"; click?(): void };
export type NativePlatform = {
  app: {
    isPackaged: boolean;
    setName(name: string): void;
    setAppUserModelId(id: string): void;
    setPath(name: string, path: string): void;
    getPath(name: string): string;
    getVersion(): string;
    requestSingleInstanceLock(): boolean;
    setLoginItemSettings(options: { openAtLogin: boolean; path: string }): void;
    disableHardwareAcceleration(): void;
    whenReady(): Promise<void>;
    quit(): void;
    exit(status: number): void;
    on(
      event: "second-instance" | "will-quit" | "window-all-closed",
      listener: () => void,
    ): void;
    on(
      event: "before-quit",
      listener: (request: { preventDefault(): void }) => void,
    ): void;
  };
  BrowserWindow: {
    new (options: NativeWindowOptions): PlatformWindow;
    getAllWindows(): PlatformWindow[];
    fromWebContents(contents: PlatformContents): PlatformWindow | null;
  };
  ipcMain: {
    handle(
      channel: string,
      listener: (request: PlatformInvocation, value: unknown) => unknown,
    ): void;
  };
  globalShortcut: {
    unregisterAll(): void;
    register(accelerator: string, listener: () => void): boolean;
  };
  desktopCapturer: {
    getSources(options: NativeCaptureOptions): Promise<NativeCaptureSource[]>;
  };
  screen: {
    getDisplayMatching(bounds: WindowBounds): {
      workArea: WindowBounds;
      scaleFactor: number;
    };
    getCursorScreenPoint(): GazePoint;
    getDisplayNearestPoint(point: GazePoint): { workArea: WindowBounds };
    getPrimaryDisplay(): { workArea: WindowBounds };
  };
  session: {
    defaultSession: PlatformSession;
    fromPartition(name: string): PlatformSession;
  };
  clipboard: { readText(): string; writeText?(text: string): void };
  dialog: {
    showSaveDialog(
      window: PlatformWindow | null,
      options: {
        defaultPath: string;
        filters: { name: string; extensions: string[] }[];
      },
    ): Promise<{ canceled: boolean; filePath?: string }>;
    showOpenDialog(
      window: PlatformWindow | null,
      options: {
        properties: readonly string[];
        filters: { name: string; extensions: string[] }[];
      },
    ): Promise<{ canceled: boolean; filePaths: string[] }>;
    showErrorBox(title: string, detail: string): void;
  };
  Menu: {
    buildFromTemplate(items: MenuItem[]): unknown;
    setApplicationMenu(menu: null): void;
  };
  Tray: new (image: unknown) => PlatformTray;
  nativeImage: { createFromPath(path: string): unknown };
  Notification: new (options: { title: string; body: string }) => {
    show(): void;
  };
  safeStorage: NativeSecretStorage;
  shell: { openExternal(url: string): Promise<unknown> };
};
