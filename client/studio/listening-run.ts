import type { ListeningPorts } from "./listening-types.js";
import type { AudioStamp } from "./transcription.js";
import { listeningError } from "./audio-error.js";
export async function runListening(
  ports: ListeningPorts,
  sessionId: string,
  stamp: AudioStamp,
  selected: () => boolean,
  alive: () => boolean,
) {
  const settings = { ...ports.settings() },
    failures: string[] = [];
  for (const kind of [
    ...(settings.transcribeMicrophone !== false ? ["microphone"] : []),
    ...(settings.systemAudio ? ["system"] : []),
  ]) {
    if (!selected()) break;
    try {
      await ports.audio.start(
        kind,
        {
          ...settings,
          sessionId,
          time: () =>
            ports.format(
              Math.max(
                0,
                Math.floor((ports.clock() - stamp.audioTimeOrigin) / 1000),
              ),
            ),
        },
        (blob, who) => {
          if (!alive()) throw new DOMException("Interrupted", "AbortError");
          return ports.transcribe(blob, who, sessionId, stamp).then(() => {});
        },
        (channel, status, detail) => {
          if (alive() && ports.current()?.id === sessionId)
            ports.state(channel, status, detail, sessionId);
        },
        (value) => {
          if (alive()) ports.transcript(value, sessionId);
        },
        (channel, item, text, done, utteranceId) => {
          if (alive()) ports.partial(channel, item, text, done, sessionId, utteranceId);
        },
      );
      if (!selected()) {
        await ports.audio.stop(kind);
        break;
      }
    } catch (error) {
      if (selected()) {
        ports.state(kind, "error", undefined, sessionId);
        failures.push(
          `${ports.translate(kind === "system" ? "Computador" : "Microfone")}: ${ports.translate(listeningError(error))}`,
        );
      }
    }
  }
  if (selected()) {
    if (settings.transcribeMicrophone === false && !settings.systemAudio)
      ports.toast("Ative sua voz ou o áudio do computador nas configurações gerais.");
    ports.render();
    if (failures.length) ports.toast(failures.join(" · "));
  }
}
