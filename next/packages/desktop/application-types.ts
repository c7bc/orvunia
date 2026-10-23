import type { PlatformWindow, PlatformTray } from "./platform-window.ts";
import type { NativePlatform } from "./platform-types.ts";
import type { NativePreferences, ShortcutName } from "./preference-types.ts";
import type { DesktopLaunch } from "./integrated-release.ts";
import type { RuntimeIdentity } from "./runtime-profile.ts";
import type { LegacyBackend } from "./legacy-types.ts";
import type { startCandidateBackend } from "./candidate.ts";
import type { NativeExtensionFactory } from "./extension.ts";

export type NativeWindowMotion = {
  show(window: PlatformWindow | null, inactive?: boolean): void;
  hide(window: PlatformWindow | null): Promise<{ hidden: boolean }>;
  complete(sender: unknown, ticket: unknown): boolean;
  isHiding(window: PlatformWindow): boolean;
  dispose(): void;
};
export type NativeOptions = {
  startBackend?: (context: NativeContext,
    controllers: import("./application-controllers.ts").NativeControllers,
    closing: () => boolean) => Promise<import("./platform-window.ts").PlatformSession>;
  extension?: NativeExtensionFactory;
  electron: NativePlatform;
  process: {
    argv: readonly string[];
    env: Record<string, string | undefined>;
    platform: string;
    arch: string;
    windowsStore?: boolean;
    execPath: string;
    versions: Record<string, string | undefined>;
    on(event: "uncaughtException", listener: () => void): unknown;
  };
  root: string;
  desktopDirectory: string;
  metadata: unknown;
  resourcesPath: string;
  createMotion(options: {
    enabled: boolean;
    onHidden(): void;
  }): NativeWindowMotion;
};
export type NativeContext = NativeOptions & {
  profile: string;
  prefsFile: string;
  launch: DesktopLaunch | null;
  identity: RuntimeIdentity | null;
  backgroundSmoke: boolean;
  smoke: boolean;
  settings: NativePreferences;
  panel: PlatformWindow | null;
  overlay: PlatformWindow | null;
  control: PlatformWindow | null;
  auxiliaryWindow?: PlatformWindow | null;
  tray: PlatformTray | null;
  backend: LegacyBackend | null;
  runtime: Awaited<ReturnType<typeof startCandidateBackend>> | null;
  starting: ReturnType<typeof startCandidateBackend> | null;
  origin: string;
  deployment: "local" | "cloud";
  remoteURL: string | null;
  vaultProtection: "file" | "os" | "remote";
  active: { id: string; mode: "recruiter" | "technical" } | null;
  sourceId: string | null;
  overlayHeight: number;
  quitting: boolean;
  failedShortcuts: ShortcutName[];
  registeredShortcutCount: number;
  blockedDisplayRequests: number;
  abort: AbortController;
};
