export type NativeAudioBridge = {
  systemAudio(value: unknown): Promise<unknown>;
  onEvent(callback: (value: unknown) => void): () => void;
};

export function nativeSystemAudioBridge(): NativeAudioBridge | null {
  const root = globalThis as typeof globalThis & { cadence?: Partial<NativeAudioBridge> };
  const raw = root.cadence;
  if (typeof navigator === "undefined" || !/^Win/i.test(navigator.platform)
    || typeof raw?.systemAudio !== "function" || typeof raw.onEvent !== "function") return null;
  return { systemAudio: raw.systemAudio.bind(raw), onEvent: raw.onEvent.bind(raw) };
}

export function supportsNativeSystemAudio() { return nativeSystemAudioBridge() !== null; }

export function nativeAudioMessage(value: unknown, captureId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message = value as Record<string, unknown>;
  if (message.type !== "system-audio" || !message.data || typeof message.data !== "object") return null;
  const data = message.data as Record<string, unknown>;
  if (data.captureId !== captureId) return null;
  if (data.type === "ended") return { type: "ended" as const };
  if (data.type === "error" && typeof data.code === "string" && /^[a-z_]{1,100}$/.test(data.code))
    return { type: "error" as const, code: data.code };
  if (data.type !== "pcm" || !Number.isSafeInteger(data.sequence) || Number(data.sequence) < 0
    || !(data.data instanceof Uint8Array) || !data.data.byteLength || data.data.byteLength > 32000 || data.data.byteLength % 2
    || typeof data.rms !== "number" || !Number.isFinite(data.rms) || data.rms < 0 || data.rms > 1
    || typeof data.peak !== "number" || !Number.isFinite(data.peak) || data.peak < 0 || data.peak > 1)
    throw Error("system_audio_protocol");
  return { type: "pcm" as const, sequence: Number(data.sequence), data: data.data, rms: data.rms, peak: data.peak };
}
