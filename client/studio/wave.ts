export async function pcmWave(
  blob: Blob,
  createContext = () => new AudioContext({ sampleRate: 16000 }),
) {
  const context = createContext();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    const count = audio.length;
    const bytes = new ArrayBuffer(44 + count * 2);
    const view = new DataView(bytes);
    const text = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index++)
        view.setUint8(offset + index, value.charCodeAt(index));
    };
    text(0, "RIFF");
    view.setUint32(4, 36 + count * 2, true);
    text(8, "WAVE");
    text(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, audio.sampleRate, true);
    view.setUint32(28, audio.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, "data");
    view.setUint32(40, count * 2, true);
    for (let index = 0; index < count; index++) {
      let sample = 0;
      for (let channel = 0; channel < audio.numberOfChannels; channel++)
        sample +=
          audio.getChannelData(channel)[index]! / audio.numberOfChannels;
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(
        44 + index * 2,
        Math.round(sample * (sample < 0 ? 32768 : 32767)),
        true,
      );
    }
    return new Blob([bytes], { type: "audio/wav" });
  } finally {
    await context.close();
  }
}
