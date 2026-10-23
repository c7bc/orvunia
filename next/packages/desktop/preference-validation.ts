import type { NativePreferences } from "./preference-types.ts";
import {
  defaultNativePreferences,
  nativeShortcutDefaults,
} from "./preference-defaults.ts";

const booleanKeys = [
  "protected",
  "noFocus",
  "clickthrough",
  "launchAtLogin",
  "systemAudio",
  "autoListen",
  "transcribeMicrophone",
  "autoAnswer",
  "autoScreen",
  "ambientChat",
  "realtime",
] as const;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Configuração inválida.");
  return value as Record<string, unknown>;
}
export function nativePreferenceUpdate(
  current: NativePreferences,
  value: unknown,
): NativePreferences {
  const fields = object(value),
    next = { ...current };
  for (const key of booleanKeys)
    if (key in fields) {
      const selected = fields[key];
      if (typeof selected !== "boolean") throw Error("Configuração inválida.");
      next[key] = selected;
    }
  if ("theme" in fields) {
    if (
      fields.theme !== "system" &&
      fields.theme !== "light" &&
      fields.theme !== "dark"
    )
      throw Error("Tema inválido.");
    next.theme = fields.theme;
  }
  if ("uiLocale" in fields) {
    if (
      fields.uiLocale !== "pt-BR" &&
      fields.uiLocale !== "en" &&
      fields.uiLocale !== "es"
    )
      throw Error("Idioma da interface inválido.");
    next.uiLocale = fields.uiLocale;
  }
  if ("opacity" in fields) {
    if (
      typeof fields.opacity !== "number" ||
      !Number.isFinite(fields.opacity) ||
      fields.opacity < 45 ||
      fields.opacity > 100
    )
      throw Error("Opacidade inválida.");
    next.opacity = fields.opacity;
  }
  if ("microphone" in fields) {
    if (typeof fields.microphone !== "string" || fields.microphone.length > 200)
      throw Error("Microfone inválido.");
    next.microphone = fields.microphone;
  }
  if ("systemAudioDevice" in fields) {
    if (typeof fields.systemAudioDevice !== "string" || !fields.systemAudioDevice.trim() ||
      fields.systemAudioDevice.length > 512 || /[\u0000-\u001f]/.test(fields.systemAudioDevice))
      throw Error("Fonte de áudio do computador inválida.");
    next.systemAudioDevice = fields.systemAudioDevice;
  }
  if ("chunkSeconds" in fields) {
    if (
      fields.chunkSeconds !== 3 &&
      fields.chunkSeconds !== 5 &&
      fields.chunkSeconds !== 8
    )
      throw Error("Intervalo inválido.");
    next.chunkSeconds = fields.chunkSeconds;
  }
  if ("answerPauseSeconds" in fields) {
    const seconds = fields.answerPauseSeconds;
    if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < 0 || seconds > 15)
      throw Error("Tempo de pausa inválido.");
    next.answerPauseSeconds = seconds;
  }
  if (fields.shortcuts) {
    const shortcuts = object(fields.shortcuts);
    next.shortcuts = { ...current.shortcuts };
    for (const [key, accelerator] of Object.entries(shortcuts)) {
      if (
        !Object.hasOwn(nativeShortcutDefaults, key) ||
        typeof accelerator !== "string" ||
        accelerator.length > 100
      )
        throw Error("Atalho inválido.");
      next.shortcuts[key as keyof typeof nativeShortcutDefaults] = accelerator;
    }
  }
  return next;
}
export function restoreNativePreferences(value: unknown): NativePreferences {
  const saved = object(value),
    defaults = defaultNativePreferences();
  let restored = { ...saved, ...defaults };
  for (const key of [
    ...booleanKeys,
    "theme",
    "uiLocale",
    "opacity",
    "microphone",
    "systemAudioDevice",
    "chunkSeconds",
    "answerPauseSeconds",
  ] as const) {
    if (!(key in saved)) continue;
    try {
      restored = nativePreferenceUpdate(restored, { [key]: saved[key] });
    } catch {}
  }
  if (saved.shortcuts && typeof saved.shortcuts === "object")
    for (const [key, accelerator] of Object.entries(saved.shortcuts)) {
      try {
        restored = nativePreferenceUpdate(restored, {
          shortcuts: { [key]: accelerator },
        });
      } catch {}
    }
  const bounds = saved.bounds;
  if (bounds && typeof bounds === "object" && !Array.isArray(bounds)) {
    const fields = bounds as Record<string, unknown>;
    if (
      [fields.x, fields.y, fields.width, fields.height].every(
        (item) => typeof item === "number" && Number.isFinite(item),
      ) &&
      (fields.width as number) > 0 &&
      (fields.height as number) > 0
    )
      restored.bounds = {
        x: fields.x as number,
        y: fields.y as number,
        width: fields.width as number,
        height: fields.height as number,
      };
  }
  if (
    typeof saved.visualRevision === "number" &&
    Number.isFinite(saved.visualRevision) &&
    saved.visualRevision > 0
  )
    restored.visualRevision = saved.visualRevision;
  else if (restored.opacity === 96) restored.opacity = 100;
  restored.clickthrough = false;
  return restored;
}
