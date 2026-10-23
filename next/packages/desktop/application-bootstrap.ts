import { join } from "node:path";
import { candidateArguments } from "./candidate-paths.ts";
import { prepareCandidateProfile } from "./candidate-profile.ts";
import { prepareRuntimeProfile } from "./runtime-profile.ts";
import { selectDesktopLaunch } from "./integrated-release.ts";
import { isolatedIntegratedProfile } from "./qa-profile.ts";
import { loadNativePreferences } from "./preference-file.ts";
import type { NativeContext, NativeOptions } from "./application-types.ts";

export function bootstrapNativeApplication(
  options: NativeOptions,
): NativeContext | null {
  const { app } = options.electron,
    { process } = options;
  const backgroundSmoke = process.argv.includes("--smoke-background"),
    smoke = backgroundSmoke || process.argv.includes("--smoke");
  if (backgroundSmoke) {
    app.disableHardwareAcceleration();
    process.on("uncaughtException", () => {
      console.error(
        "Background native verification failed during initialization.",
      );
      app.exit(1);
    });
  }
  app.setName("Orvunia");
  const installedProfile = join(app.getPath("appData"), "Cadence");
  const candidate = candidateArguments(process.argv, installedProfile);
  let launch = selectDesktopLaunch({
    candidate,
    installedProfile,
    packaged: app.isPackaged,
    resources: options.resourcesPath,
    metadata: options.metadata,
  });
  launch = isolatedIntegratedProfile({
    requested: process.env.CADENCE_TEST_INTEGRATED_PROFILE,
    background: backgroundSmoke,
    launch,
    installedProfile,
  });
  const profile =
    launch?.profile ||
    (smoke
      ? join(app.getPath("temp"), "cadence-desktop-smoke")
      : installedProfile);
  const candidateIdentity = launch?.kind === "candidate"
    ? prepareCandidateProfile(profile)
    : null;
  if (process.windowsStore !== true)
    app.setAppUserModelId(
      launch?.kind === "candidate"
        ? "local.cadence.candidate"
        : "local.cadence.studio",
    );
  app.setPath("userData", profile);
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return null;
  }
  const identity = launch
    ? launch.kind === "candidate"
      ? candidateIdentity
      : prepareRuntimeProfile({ directory: profile, ownsLock: true })
    : null;
  const prefsFile = join(profile, "desktop.json");
  return {
    ...options,
    profile,
    prefsFile,
    launch,
    identity,
    backgroundSmoke,
    smoke,
    settings: loadNativePreferences(prefsFile),
    panel: null,
    overlay: null,
    control: null,
    tray: null,
    backend: null,
    runtime: null,
    starting: null,
    origin: "",
    deployment: "local",
    remoteURL: null,
    vaultProtection: "file",
    active: null,
    sourceId: null,
    overlayHeight: 152,
    quitting: false,
    failedShortcuts: [],
    registeredShortcutCount: 0,
    blockedDisplayRequests: 0,
    abort: new AbortController(),
  };
}
