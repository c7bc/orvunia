import type { OverlayState } from "./state.js";
export function renderAudioLabel(context: OverlayState) {
  const { current, audio, audioStatus } = context;
  const translate = context.translate ?? (value => value);

  if (current?.state === "paused") return translate("Sessão pausada");
  if (audio.running)
    return translate(audioStatus.system === "recording"
      ? audioStatus.microphone === "recording" ? "Computador + mic · ouvindo" : "Computador · ouvindo"
      : "Mic · ouvindo");
  return translate("Escuta desligada");
}
