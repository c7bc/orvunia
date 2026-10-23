import type { AudioChannel } from "./contracts.js";
export function audioShutdownError(channel: AudioChannel) {
  return "shutdownError" in channel ? channel.shutdownError : channel.error;
}
export function audioStops() {
  const pending = new Map<
      AudioChannel,
      { kind: string; promise: Promise<void> }
    >(),
    unconfirmed = new Map<AudioChannel, string>(),
    stopFailures = new Map<AudioChannel, Error>();
  const failure = (channel: AudioChannel) => stopFailures.get(channel) ?? audioShutdownError(channel);
  return {
    error: failure,
    clear(kind: string) {
      for (const [channel, source] of unconfirmed)
        if (source === kind && !failure(channel)) unconfirmed.delete(channel);
    },
    channels: () =>
      [...pending.entries()].map(
        ([channel, value]) => [value.kind, channel] as const,
      ),
    failures: () => [...unconfirmed].map(([channel, kind]) => [kind, channel] as const),
    pending(kind?: string) {
      return [...pending.values()]
        .filter((value) => !kind || value.kind === kind)
        .map((value) => value.promise);
    },
    stop(kind: string, channel: AudioChannel) {
      const existing = pending.get(channel);
      if (existing) return existing.promise;
      const promise = Promise.resolve()
        .then(() => channel.stop())
        .then(() => { stopFailures.delete(channel); })
        .catch((error: unknown) => {
          channel.error = error instanceof Error ? error : Error(String(error));
          stopFailures.set(channel, channel.error);
          throw channel.error;
        })
        .finally(() => {
          pending.delete(channel);
          if (failure(channel)) unconfirmed.set(channel, kind);
          else unconfirmed.delete(channel);
        });
      pending.set(channel, { kind, promise });
      return promise;
    },
  };
}
