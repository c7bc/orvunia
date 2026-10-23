import type { ApplicationDesktop } from "./model.js";
import type { CommandSettings } from "../commands/model.js";
import { record, text } from "../legacy-web/validation.js";
import { readDistribution } from "../platform/distribution.js";

function settings(value: unknown): CommandSettings {
  const input = record(value),
    result: CommandSettings = { ...input, answerPauseSeconds: 1, shortcuts: {} };
  for (const key of [
    "protected",
    "noFocus",
    "clickthrough",
    "systemAudio",
    "autoListen",
    "transcribeMicrophone",
    "autoAnswer",
    "autoScreen",
    "ambientChat",
    "realtime",
    "launchAtLogin",
  ])
    if (input[key] !== undefined && typeof input[key] !== "boolean")
      throw Error("Configuração nativa inválida: " + key);
  for (const key of ["opacity", "chunkSeconds", "answerPauseSeconds"])
    if (
      input[key] !== undefined &&
      (typeof input[key] !== "number" || !Number.isFinite(input[key]))
    )
      throw Error("Configuração nativa inválida: " + key);
  if (input.answerPauseSeconds !== undefined &&
    (!Number.isInteger(input.answerPauseSeconds) || Number(input.answerPauseSeconds) < 0 || Number(input.answerPauseSeconds) > 15))
    throw Error("Configuração nativa inválida: answerPauseSeconds");
  if (typeof input.answerPauseSeconds === "number") result.answerPauseSeconds = input.answerPauseSeconds;
  for (const key of ["theme", "uiLocale", "microphone", "systemAudioDevice"])
    if (input[key] !== undefined && typeof input[key] !== "string")
      throw Error("Configuração nativa inválida: " + key);
  for (const [key, value] of Object.entries(record(input.shortcuts)))
    result.shortcuts[key] = text(value);
  return result;
}

export function applicationDesktop(value: unknown): ApplicationDesktop {
  const item = record(value);
  if (
    item.overlayVisible !== undefined &&
    typeof item.overlayVisible !== "boolean"
  )
    throw Error("Visibilidade nativa inválida.");
  if (
    !Array.isArray(item.failedShortcuts) ||
    !item.failedShortcuts.every((value) => typeof value === "string")
  )
    throw Error("Atalhos nativos inválidos.");
  const active =
    item.active === undefined
      ? undefined
      : item.active === null
        ? null
        : { ...record(item.active), id: text(record(item.active).id) };
  const gaze = item.gaze === undefined ? undefined : record(item.gaze);
  if (gaze?.enabled !== undefined && typeof gaze.enabled !== "boolean")
    throw Error("Estado nativo de acompanhamento inválido.");
  return {
    ...item,
    ...(item.distribution === undefined ? {} : { distribution: readDistribution(item.distribution) }),
    settings: settings(item.settings),
    failedShortcuts: item.failedShortcuts,
    ...(active === undefined ? {} : { active }),
    ...(gaze === undefined
      ? {}
      : {
          gaze: {
            ...gaze,
            ...(gaze.enabled === undefined ? {} : { enabled: gaze.enabled }),
          },
        }),
    ...(item.overlayVisible === undefined
      ? {}
      : { overlayVisible: item.overlayVisible === true }),
    ...(item.version === undefined ? {} : { version: text(item.version) }),
    ...(item.platform === undefined ? {} : { platform: text(item.platform) }),
    ...(item.arch === undefined ? {} : { arch: text(item.arch) }),
  };
}
