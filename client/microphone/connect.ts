import type { DiagnosticResources } from "./contracts";
import { diagnosticFailure } from "./errors";
import { stopTracks } from "./resources";
export async function connectMicrophone(dependencies: {
  media: Pick<MediaDevices, "getUserMedia">;
  Context: typeof AudioContext;
  resources: DiagnosticResources;
  deviceId: string;
  valid(): boolean;
  stop(reason: string): void;
}) {
  const { media, deviceId, resources, Context, valid } = dependencies;
  const stream = await media.getUserMedia({
    audio:
      deviceId && deviceId !== "default"
        ? { deviceId: { exact: deviceId } }
        : true,
    video: false,
  });
  // Permission prompts cannot be cancelled; late streams must never reach Web Audio.
  if (!valid()) {
    stopTracks(stream);
    return null;
  }
  resources.stream = stream;
  const tracks = stream.getAudioTracks?.() ?? [];
  if (!tracks.length || tracks.every((track) => track.readyState === "ended"))
    throw diagnosticFailure(
      "no_audio",
      "O microfone não forneceu áudio disponível.",
    );
  for (const track of tracks) {
    const ended = () => {
      if (valid()) dependencies.stop("device-ended");
    };
    track.addEventListener?.("ended", ended, { once: true });
    resources.ended.push([track, ended]);
  }
  const context = new Context();
  resources.context = context;
  if (context.state === "suspended") await context.resume();
  if (!valid()) return null;
  const source = context.createMediaStreamSource(stream);
  resources.source = source;
  const analyser = context.createAnalyser();
  resources.analyser = analyser;
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);
  return analyser;
}
