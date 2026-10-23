import { LocalModelError } from "./domain.ts";

export function validatePcmWave(audio: Uint8Array): void {
  if (audio.byteLength < 44 || audio.byteLength > 32 * 1024 ** 2) throw new LocalModelError("local_audio_invalid");
  const bytes = Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE" ||
    bytes.readUInt32LE(4) + 8 !== bytes.length) throw new LocalModelError("local_audio_invalid");
  let format = false;
  let samples = false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const begin = offset + 8;
    if (begin + length > bytes.length) throw new LocalModelError("local_audio_invalid");
    if (kind === "fmt ") {
      if (length < 16 || bytes.readUInt16LE(begin) !== 1 || bytes.readUInt16LE(begin + 2) !== 1 ||
        bytes.readUInt32LE(begin + 4) !== 16000 || bytes.readUInt16LE(begin + 14) !== 16 ||
        bytes.readUInt16LE(begin + 12) !== 2) throw new LocalModelError("local_audio_requires_pcm16_mono_16khz");
      format = true;
    }
    if (kind === "data") samples = length > 0 && length % 2 === 0;
    offset = begin + length + length % 2;
  }
  if (!format || !samples) throw new LocalModelError("local_audio_invalid");
}

export function isDigitalSilence(audio: Uint8Array): boolean {
  validatePcmWave(audio);
  const bytes = Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset + 4);
    const begin = offset + 8;
    if (bytes.toString("ascii", offset, offset + 4) === "data") {
      for (let index = begin; index < begin + length; index++) if (bytes[index] !== 0) return false;
    }
    offset = begin + length + length % 2;
  }
  return true;
}
