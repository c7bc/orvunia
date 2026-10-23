import type { DiagnosticClock, DiagnosticResources } from "./contracts";
export function startMeter(dependencies: {
  resources: DiagnosticResources;
  analyser: AnalyserNode;
  clock: DiagnosticClock;
  startedAt: number;
  valid(): boolean;
  level(): number;
  update(level: number, details: { rms: number; elapsedMs: number }): void;
  fail(error: unknown): void;
}) {
  const { analyser, clock, resources } = dependencies;
  const read =
    typeof analyser.getFloatTimeDomainData === "function"
      ? (() => {
          const samples = new Float32Array(analyser.fftSize);
          return () => {
            analyser.getFloatTimeDomainData(samples);
            return samples;
          };
        })()
      : (() => {
          const samples = new Uint8Array(analyser.fftSize);
          return () => {
            analyser.getByteTimeDomainData(samples);
            return samples;
          };
        })();
  const floating = typeof analyser.getFloatTimeDomainData === "function";
  function tick() {
    if (!dependencies.valid()) return;
    resources.frame = null;
    try {
      const samples = read();
      let total = 0;
      for (const sample of samples) {
        const value = floating ? sample : (sample - 128) / 128;
        total += value * value;
      }
      if (!Number.isFinite(total)) throw Error("Invalid local audio samples");
      const rms = Math.max(0, Math.min(1, Math.sqrt(total / samples.length))),
        level = dependencies.level(),
        smoothing = rms > level ? 0.45 : 0.12;
      dependencies.update(level + (rms - level) * smoothing, {
        rms,
        elapsedMs: Math.max(0, clock.now() - dependencies.startedAt),
      });
      if (dependencies.valid())
        resources.frame = clock.requestAnimationFrame(tick);
    } catch (error) {
      if (dependencies.valid()) dependencies.fail(error);
    }
  }
  resources.frame = clock.requestAnimationFrame(tick);
}
