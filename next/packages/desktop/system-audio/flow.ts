import { SystemAudioError } from "./ports.ts";
import type { SystemAudioEvent } from "./ports.ts";

export function createPcmFlow(captureId: string, emit: (event: SystemAudioEvent) => void) {
  let receivedBytes = 0, pendingBytes = 0, sequence = 0, carry = new Uint8Array(0);
  const pending = new Map<number, number>();
  const waiters = new Set<{ bytes: number; resolve(): void; reject(error: unknown): void }>();
  function settle() {
    for (const waiter of waiters) if (receivedBytes >= waiter.bytes) { waiters.delete(waiter); waiter.resolve(); }
  }
  return {
    bytes: () => receivedBytes,
    feed(input: Uint8Array) {
      if (!input.byteLength) return;
      const bytes = new Uint8Array(carry.byteLength + input.byteLength);
      bytes.set(carry); bytes.set(input, carry.byteLength);
      const aligned = bytes.byteLength - bytes.byteLength % 2;
      carry = bytes.slice(aligned);
      for (let offset = 0; offset < aligned; offset += 32000) {
        const data = bytes.slice(offset, Math.min(aligned, offset + 32000));
        if (pendingBytes + data.byteLength > 480000) throw new SystemAudioError("system_audio_backpressure");
        let squares = 0, peak = 0;
        const samples = new DataView(data.buffer, data.byteOffset, data.byteLength);
        for (let index = 0; index < data.byteLength; index += 2) {
          const sample = samples.getInt16(index, true) / 32768;
          squares += sample * sample; peak = Math.max(peak, Math.abs(sample));
        }
        receivedBytes += data.byteLength; pendingBytes += data.byteLength;
        pending.set(sequence, data.byteLength);
        emit({ type: "pcm", captureId, sequence: sequence++, data, rms: Math.sqrt(squares / (data.byteLength / 2)), peak });
      }
      settle();
    },
    acknowledge(value: number) {
      if (!Number.isSafeInteger(value) || value < 0 || value >= sequence) throw new SystemAudioError("system_audio_receipt_invalid");
      for (const [key, bytes] of pending) if (key <= value) { pendingBytes -= bytes; pending.delete(key); }
    },
    watermark(frames: number) {
      if (receivedBytes >= frames * 2) return Promise.resolve();
      return new Promise<void>((resolve, reject) => { waiters.add({ bytes: frames * 2, resolve, reject }); });
    },
    finish(frames?: number) {
      const error = new SystemAudioError("system_audio_incomplete");
      for (const waiter of waiters) waiter.reject(error);
      waiters.clear(); pending.clear(); carry = new Uint8Array(0);
      if (frames !== undefined && frames * 2 !== receivedBytes) throw error;
    },
  };
}
