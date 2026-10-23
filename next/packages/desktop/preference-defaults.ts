import type { NativePreferences, ShortcutName } from "./preference-types.ts";

export const nativeShortcutDefaults: Readonly<Record<ShortcutName, string>> =
  Object.freeze({
    toggle: "CommandOrControl+Shift+Space",
    ask: "CommandOrControl+Enter",
    capture: "CommandOrControl+Shift+S",
    clear: "CommandOrControl+Shift+R",
    camera: "CommandOrControl+Shift+Home",
    cursor: "CommandOrControl+Shift+M",
    clickthrough: "CommandOrControl+Shift+I",
    up: "CommandOrControl+Alt+Up",
    down: "CommandOrControl+Alt+Down",
    left: "CommandOrControl+Alt+Left",
    right: "CommandOrControl+Alt+Right",
    scrollUp: "CommandOrControl+Shift+Up",
    scrollDown: "CommandOrControl+Shift+Down",
    pause: "CommandOrControl+Shift+P",
  });
export function defaultNativePreferences(): NativePreferences {
  return {
    protected: true,
    noFocus: false,
    clickthrough: false,
    opacity: 100,
    theme: "system",
    uiLocale: "pt-BR",
    launchAtLogin: false,
    shortcuts: { ...nativeShortcutDefaults },
    bounds: null,
    microphone: "default",
    systemAudioDevice: "default:multimedia",
    systemAudio: true,
    autoListen: false,
    transcribeMicrophone: true,
    autoAnswer: false,
    answerPauseSeconds: 1,
    autoScreen: false,
    ambientChat: false,
    realtime: true,
    chunkSeconds: 5,
    visualRevision: 3,
  };
}
