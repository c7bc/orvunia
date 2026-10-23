import type { NativeContext } from "./application-types.ts";
import type { PlatformWindow } from "./platform-window.ts";
import { saveNativePreferences } from "./preference-file.ts";
export function nativeWindows(context: NativeContext) {
  return [context.panel, context.overlay, context.control].filter(
    (window): window is PlatformWindow =>
      window !== null && !window.isDestroyed(),
  );
}
export function nativeEvent(
  context: NativeContext,
  type: string,
  data: unknown,
) {
  for (const window of nativeWindows(context))
    window.webContents.send("cadence:event", { type, data });
}
export function saveNativeState(context: NativeContext) {
  saveNativePreferences(context.prefsFile, context.settings);
}
export function nativeLocale(
  context: Pick<NativeContext, "settings">,
  portuguese: string,
  english: string,
  spanish: string,
) {
  return context.settings.uiLocale === "es"
    ? spanish
    : context.settings.uiLocale === "en"
      ? english
      : portuguese;
}
export function requireNativeWindow(
  context: NativeContext,
  kind: "panel" | "overlay" | "control",
) {
  const window = context[kind];
  if (!window || window.isDestroyed())
    throw Error("A janela do aplicativo não está disponível.");
  return window;
}
