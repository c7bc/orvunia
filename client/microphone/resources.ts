import type { DiagnosticClock, DiagnosticResources } from "./contracts";
export const emptyResources = (): DiagnosticResources => ({
  stream: null,
  context: null,
  source: null,
  analyser: null,
  frame: null,
  timer: null,
  abort: null,
  ended: [],
});
export function stopTracks(stream: MediaStream | null) {
  try {
    for (const track of stream?.getTracks?.() ?? []) {
      try {
        track.stop();
      } catch {}
    }
  } catch {}
}
export function releaseResources(
  held: DiagnosticResources,
  clock: DiagnosticClock,
) {
  if (held.frame !== null) {
    try {
      clock.cancelAnimationFrame(held.frame);
    } catch {}
  }
  if (held.timer !== null) {
    try {
      clock.clearTimeout(held.timer);
    } catch {}
  }
  try {
    held.abort?.();
  } catch {}
  for (const [track, listener] of held.ended) {
    try {
      track.removeEventListener?.("ended", listener);
    } catch {}
  }
  try {
    held.source?.disconnect();
  } catch {}
  try {
    held.analyser?.disconnect();
  } catch {}
  stopTracks(held.stream);
  try {
    if (held.context && held.context.state !== "closed")
      void Promise.resolve(held.context.close()).catch(() => {});
  } catch {}
}
