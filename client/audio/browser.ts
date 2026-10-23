import type { AudioPlatform } from "./contracts";

export function browserAudio(): AudioPlatform {
  return {
    available: () =>
      Boolean(
        typeof navigator.mediaDevices?.getUserMedia === "function" &&
        typeof MediaRecorder !== "undefined",
      ),
    displayAvailable: () =>
      typeof navigator.mediaDevices?.getDisplayMedia === "function",
    display: () =>
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }),
    microphone: (device) =>
      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          ...(device && device !== "default"
            ? { deviceId: { exact: device } }
            : {}),
        },
        video: false,
      }),
    stream: (tracks) => new MediaStream(tracks),
    format: () =>
      ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((mime) =>
        MediaRecorder.isTypeSupported(mime),
      ),
    context: () => new AudioContext(),
    recorder: (stream, mime) => new MediaRecorder(stream, { mimeType: mime }),
    clock: () => Date.now(),
  };
}
