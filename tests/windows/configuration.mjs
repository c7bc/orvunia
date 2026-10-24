import { appId, productName, desktopVersion } from "./config.mjs";
export function desktopConfiguration(source, runtime, output, electronDirectory) {
  return { extends: null, compression: "normal", appId, productName,
    extraMetadata: { name: "orvunia-qa", version: desktopVersion, main: "desktop/main.cjs", dependencies: null,
      cadenceDesktop: { format: "cadence-desktop-release/1", runtime: "bun", channel: "integrated" } },
    files: ["!**/*", "./desktop/main.cjs", "./desktop/runtime.cjs", "./desktop/preload.cjs", "./desktop/preload-personal.cjs",
      "./desktop/preload-auxiliary.cjs", "./desktop/system-audio/**", "./desktop/window-motion.cjs", "./desktop/affinity.ps1",
      "./assets/icon.ico", "./assets/icon.png", "./package.json", "./LICENSE", "./THIRD_PARTY_NOTICES.txt", "./assets/licenses/**",
      "!node_modules{,/**/*}", "!**/node_modules/**"],
    asar: true, asarUnpack: ["desktop/system-audio/**"], npmRebuild: false, forceCodeSigning: false,
    electronDist: electronDirectory, electronVersion: "44.7.2", directories: { output },
    extraResources: [{ from: runtime, to: "cadence-runtime", filter: ["**/*", "!.package-owner"] }],
    win: { icon: source + "/assets/icon.ico", signExecutable: false },
    portable: { artifactName: "Orvunia-QA-Portable-${version}.exe" },
    nsis: { artifactName: "Orvunia-QA-Setup-${version}.exe", uninstallDisplayName: productName,
      oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true,
      createDesktopShortcut: false, createStartMenuShortcut: false, runAfterFinish: false, deleteAppDataOnUninstall: false },
    publish: null };
}
