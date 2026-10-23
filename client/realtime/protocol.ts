import type { Transcript } from "./contracts";
import { utteranceFields } from "../audio/utterance.js";
type Event =
  | { type: "ready"; supportsFlush: boolean }
  | { type: "delta"; itemId: string; text: string; replace: boolean; utteranceId?: string }
  | { type: "final"; itemId: string; transcript?: Transcript }
  | { type: "flushed"; id: string }
  | { type: "flush-error"; id: string; message: string }
  | { type: "error"; message: string };
export type WorkletEvent =
  | { type: "activity"; active: boolean; silentForMilliseconds?: number }
  | { type: "flushed"; id?: string }
  | { type: "audio"; data: ArrayBuffer }
  | { type: "commit"; end?: boolean }
  | WorkletSignal;
export type WorkletSignal = { type: "signal"; mode: "continuous" | "gated";
  receivedSamples: number; sentSamples: number; commits: number;
  rms: number; peak: number; channels: number };
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Evento de áudio inválido.");
  return value as Record<string, unknown>;
};
function text(value: unknown, maximum = 16000) {
  if (typeof value !== "string" || value.length > maximum)
    throw Error("Evento de áudio inválido.");
  return value;
}
function transcript(value: unknown): Transcript {
  const item = record(value);
  return {
    id: text(item.id, 200),
    text: text(item.text),
    who: text(item.who, 60),
    time: text(item.time, 30),
    source: text(item.source, 30),
    ...utteranceFields(item.utteranceId),
    ...(typeof item.segmentId === "string"
      ? { segmentId: text(item.segmentId, 200) }
      : {}),
  };
}
export function serverEvent(input: unknown): Event | null {
  const value = record(JSON.parse(text(input, 512 * 1024)));
  switch (value.type) {
    case "ready":
      return { type: "ready", supportsFlush: value.supportsFlush === true };
    case "delta":
      return {
        type: "delta",
        itemId: text(value.itemId, 200),
        text: text(value.text),
        replace: value.replace === true,
        ...utteranceFields(value.utteranceId),
      };
    case "final":
      return {
        type: "final",
        itemId: text(value.itemId, 200),
        ...(value.transcript
          ? { transcript: transcript(value.transcript) }
          : {}),
      };
    case "flushed":
      return { type: "flushed", id: text(value.id, 200) };
    case "flush-error":
      return {
        type: "flush-error",
        id: text(value.id, 200),
        message: text(value.message, 2000),
      };
    case "error":
      return { type: "error", message: text(value.message, 2000) };
    default:
      return null;
  }
}
export function workletEvent(input: unknown): WorkletEvent | null {
  const value = record(input);
  switch (value.type) {
    case "signal": {
      const counters = [value.receivedSamples, value.sentSamples, value.commits, value.channels];
      if (counters.some((entry) => typeof entry !== "number" || !Number.isSafeInteger(entry) || entry < 0)
        || (value.mode !== "continuous" && value.mode !== "gated")
        || typeof value.rms !== "number" || !Number.isFinite(value.rms) || value.rms < 0 || value.rms > 1
        || typeof value.peak !== "number" || !Number.isFinite(value.peak) || value.peak < 0 || value.peak > 1)
        return null;
      return { type: "signal", mode: value.mode, receivedSamples: value.receivedSamples as number,
        sentSamples: value.sentSamples as number, commits: value.commits as number,
        channels: value.channels as number, rms: value.rms, peak: value.peak };
    }
    case "activity": {
      const milliseconds = value.silentForMilliseconds;
      if (milliseconds !== undefined && (typeof milliseconds !== "number" || !Number.isFinite(milliseconds) ||
        milliseconds < 0 || milliseconds > 60000)) return null;
      return { type: "activity", active: value.active === true,
        ...(typeof milliseconds === "number" ? { silentForMilliseconds: milliseconds } : {}) };
    }
    case "flushed":
      return {
        type: "flushed",
        ...(typeof value.id === "string" ? { id: text(value.id, 200) } : {}),
      };
    case "commit":
      return { type: "commit", ...(value.end === true ? { end: true } : {}) };
    case "audio":
      if (value.data instanceof ArrayBuffer && value.data.byteLength <= 480_000)
        return { type: "audio", data: value.data };
      return null;
    default:
      return null;
  }
}
