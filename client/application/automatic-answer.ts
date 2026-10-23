export function createAutomaticAnswer(ports: {
  clock(): number;
  schedule(callback: () => void, delay: number): number;
  clear(timer: number): void;
  scope(): string | null;
  enabled(): boolean;
  speaking(): boolean;
  busy(): boolean;
  lastAnswer(): number;
  pauseSeconds?(): number;
  quietSince?(): number | null;
  answer(): void;
}) {
  let timer: number | null = null, scope: string | null = null, disposed = false;
  let quietSince: number | null = null;
  function pause() {
    const seconds = ports.pauseSeconds?.() ?? 1;
    return Number.isInteger(seconds) && seconds >= 0 && seconds <= 15 ? seconds * 1000 : 1000;
  }
  function reset() {
    if (timer !== null) ports.clear(timer);
    timer = null;
    scope = null;
    quietSince = null;
  }
  function later(delay: number) {
    timer = ports.schedule(check, delay);
  }
  function quietAnchor() {
    const anchor = ports.quietSince?.();
    return typeof anchor === "number" && Number.isFinite(anchor) && anchor <= ports.clock() ? anchor : null;
  }
  function check() {
    timer = null;
    if (disposed || !scope || scope !== ports.scope() || !ports.enabled()) return reset();
    if (ports.speaking()) { quietSince = null; return later(200); }
    const anchor = quietAnchor();
    quietSince = anchor === null ? (quietSince ?? ports.clock()) : Math.max(quietSince ?? anchor, anchor);
    const remaining = pause() - (ports.clock() - quietSince);
    if (remaining > 0) return later(Math.min(remaining, 200));
    if (ports.busy()) return later(200);
    const cooldown = 1000 - (ports.clock() - ports.lastAnswer());
    if (cooldown > 0) return later(Math.min(cooldown, 200));
    reset();
    ports.answer();
  }
  function resume() {
    if (disposed || timer !== null || !ports.enabled()) return;
    scope = ports.scope();
    quietSince = ports.speaking() ? null : (quietAnchor() ?? ports.clock());
    if (scope) later(0);
  }
  return {
    confirmed() {
      if (disposed) return;
      reset();
      resume();
    },
    resume,
    reset,
    dispose() { reset(); disposed = true; },
  };
}
