import type { ChunkRecorder } from "./recorder";
import { capturedSignal } from "./signal";
import type {
  ChunkCallback,
  RecorderOptions,
  StateCallback,
} from "./contracts";

export async function startAudio(
  state: ChunkRecorder,
  source: string,
  onChunk: ChunkCallback,
  onState: StateCallback,
  options: RecorderOptions,
) {
  const platform = state.platform;
  if (!platform.available())
    throw Error(
      "Este navegador não permite gravação. Use a importação de áudio.",
    );
  if (source === "display" && !platform.displayAvailable())
    throw Error(
      "Compartilhamento de áudio não disponível neste navegador. Use o microfone ou importe um arquivo.",
    );
  if (state.running || state.starting) return;
  state.starting = true;
  const generation = ++state.generation;
  const assertCurrent = () => {
    if (state.generation !== generation)
      throw new DOMException("Interrupted", "AbortError");
  };
  state.onChunk = onChunk;
  state.onState = onState;
  state.stopPromise = null;
  state.error = null;
  state.chunkMilliseconds = (options.seconds || 6) * 1000;
  let acquired: MediaStream | undefined;
  try {
    acquired =
      source === "display"
        ? await platform.display()
        : await platform.microphone(options.device);
    assertCurrent();
    state.stream = acquired;
    if (!state.stream.getAudioTracks().length)
      throw Error(
        "Nenhum áudio foi compartilhado. Selecione uma aba e marque “Compartilhar áudio”.",
      );
    state.audioStream = platform.stream(state.stream.getAudioTracks());
    state.mime = platform.format();
    if (!state.mime)
      throw Error(
        "Gravação de áudio não suportada neste navegador. Use a importação de arquivo.",
      );
    const context = (state.audioContext = platform.context());
    await context.resume();
    assertCurrent();
    const analyser = (state.analyser = context.createAnalyser());
    analyser.fftSize = 512;
    state.source = context.createMediaStreamSource(state.audioStream);
    state.source.connect(analyser);
    state.speech = false;
    const values = new Float32Array(512);
    state.levelTimer = setInterval(() => {
      analyser.getFloatTimeDomainData(values);
      const signal = capturedSignal(values, source === "display");
      if (signal.active) state.speech = true;
      state.activity(signal.active);
    }, 100);
    state.running = true;
    state.recordChunk();
    onState("recording");
    state.stream.getAudioTracks()[0]?.addEventListener(
      "ended",
      () => {
        if (state.running) void state.stop().then(() => onState("ended"));
      },
      { once: true },
    );
  } catch (error) {
    state.running = false;
    state.currentStopped = Promise.resolve();
    state.release();
    if (acquired && state.stream !== acquired)
      acquired.getTracks().forEach((track) => track.stop());
    throw error;
  } finally {
    state.starting = false;
  }
}
