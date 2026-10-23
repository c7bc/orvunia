export function nativePcmWave(parts: readonly Uint8Array[], length: number) {
  const buffer = new ArrayBuffer(44 + length), view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index));
  };
  text(0, "RIFF"); view.setUint32(4, 36 + length, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true); view.setUint32(28, 48000, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, length, true);
  const bytes = new Uint8Array(buffer);
  let offset = 44;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  if (offset !== bytes.length || length % 2) throw Error("system_audio_protocol");
  return new Blob([buffer], { type: "audio/wav" });
}
