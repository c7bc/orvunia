import type { RealtimePlatform } from "./contracts";
import { browserAudio } from "../audio/browser";
import { nativeSystemAudioBridge } from "../system-audio/bridge.js";

export function browserRealtime(): RealtimePlatform {
  const media = browserAudio();
  const native = nativeSystemAudioBridge();
  return {
    ...(native ? { native } : {}),
    request: (input, options) => {
      const headers = new Headers(options.headers);
      if (!headers.has("Accept-Language")) {
        const locale = (typeof document !== "undefined" ? document.documentElement.lang : "") ||
          (typeof navigator !== "undefined" ? navigator.language : "en");
        headers.set("Accept-Language", locale);
      }
      return fetch(input, { ...options, headers });
    },
    socket: (ticket) =>
      new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/realtime?ticket=${encodeURIComponent(ticket)}`,
      ),
    acquire: (source, device) =>
      source === "display" ? media.display() : media.microphone(device),
    context: () => new AudioContext({ sampleRate: 24000 }),
    stream: media.stream,
    processor: (context, source) =>
      new AudioWorkletNode(context, "cadence-pcm", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        ...(source === "display" ? { channelCountMode: "max" as const,
          channelInterpretation: "discrete" as const, processorOptions: { continuous: true } } : {}),
      }),
    open: (socket) => socket?.readyState === WebSocket.OPEN,
    clock: () => Date.now(),
    identifier: () => crypto.randomUUID(),
  };
}
