import type {
  AudioChannel,
  StudioCallbacks,
  StudioPlatform,
  StudioSettings,
} from "./contracts.js";
export async function startChannel(
  kind: string,
  settings: StudioSettings,
  callbacks: StudioCallbacks,
  platform: StudioPlatform,
  register: (channel: AudioChannel) => void,
) {
  const source = kind === "system" ? "display" : "microphone";
  const state = (status: string, detail?: unknown) =>
    callbacks.state(kind, status, detail);
  state("starting");
  const selected = kind === "system" ? settings.systemAudioDevice : settings.microphone;
  const device = selected ? { device: selected } : {};
  if (settings.realtime) {
    const channel = platform.realtime();
    register(channel);
    await channel.start(source, callbacks.transcript, state, {
      ...device,
      sessionId: settings.sessionId,
      time: settings.time,
      onPartial: (item, text, done, utteranceId) =>
        callbacks.partial?.(kind, item, text, done, utteranceId),
    });
  } else {
    const channel = platform.chunk(source);
    register(channel);
    await channel.start(
      source,
      async (blob) =>
        callbacks.chunk(
          settings.pcmChunks ? await platform.wave(blob) : blob,
          kind === "system" ? "Entrevistador" : "Eu",
        ),
      state,
      {
        ...device,
        sessionId: settings.sessionId,
        ...(settings.chunkSeconds !== undefined
          ? { seconds: settings.chunkSeconds }
          : {}),
      },
    );
  }
}
