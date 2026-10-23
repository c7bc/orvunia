import { createSystemAudioManager } from "../../packages/desktop/system-audio/manager.ts";
import { enumerateSystemAudio } from "../../packages/desktop/system-audio/enumerate.ts";
import type { HelperEvents, HelperProcess, LaunchHelper, SystemAudioEvent } from "../../packages/desktop/system-audio/ports.ts";

export const syntheticEndpoint = "{0.0.0.00000000}.{11111111-1111-1111-1111-111111111111}";
export const syntheticCatalog = { supported: true, endpoints: [{ id: syntheticEndpoint, name: "Controlled communication output",
  defaultConsole: false, defaultMultimedia: false, defaultCommunications: true }],
  defaults: { console: null, multimedia: null, communications: syntheticEndpoint } };

export function systemAudioFixture() {
  let allowed = true, supported = true, autoReady = true, flushFrames: number | null = null;
  let current: HelperEvents | null = null, bytes = 0, closed = false;
  const actions: string[] = [], commands: Record<string, unknown>[] = [], events: SystemAudioEvent[] = [];
  const listeners = new Set<(event: SystemAudioEvent) => void>();
  let finish: (code: number | null) => void = () => {};
  const close = (code: number | null = 0, includeMetadata = true) => {
    if (closed) return; closed = true;
    if (includeMetadata) current?.metadata({ event: "stopped", frames: bytes / 2, discontinuities: 0 });
    current?.exited(code); finish(code);
  };
  const launch: LaunchHelper = (action, handlers) => {
    actions.push(action); current = handlers; bytes = 0; closed = false;
    const process: HelperProcess = {
      closed: new Promise<number | null>((resolve) => { finish = resolve; }),
      command(value) {
        commands.push(value);
        if (value.command === "start" && autoReady) queueMicrotask(() => handlers.metadata({ event: "ready",
          endpointId: syntheticEndpoint, sampleRate: 24000, channels: 1, format: "pcm_s16le" }));
        if (value.command === "flush") queueMicrotask(() => handlers.metadata({ event: "flushed", id: value.id, frames: flushFrames ?? bytes / 2 }));
        if (value.command === "stop") queueMicrotask(() => close());
        return !closed;
      },
      endInput() {}, terminate: () => close(null, false),
    };
    if (action === "enumerate") queueMicrotask(() => { handlers.data(new TextEncoder().encode(JSON.stringify(syntheticCatalog))); close(0, false); });
    return process;
  };
  const manager = createSystemAudioManager({ supported: () => supported, allowed: () => allowed,
    launch, enumerate: () => enumerateSystemAudio(launch), event: (_owner, event) => {
      events.push(event); for (const listener of listeners) listener(event);
    } });
  const start = (captureId = crypto.randomUUID(), sender = 12) => {
    const input = { action: "start", captureId, sessionId: crypto.randomUUID(), endpointId: "default:communications", consent: true };
    return { input, pending: manager.invoke(sender, input) };
  };
  return { manager, actions, commands, events, start, close,
    subscribe(listener: (event: SystemAudioEvent) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    data(value: Uint8Array) { bytes += value.byteLength; current?.data(value); },
    metadata(value: unknown) { current?.metadata(value); },
    allow(value: boolean) { allowed = value; }, support(value: boolean) { supported = value; },
    ready(value: boolean) { autoReady = value; }, flushTarget(value: number) { flushFrames = value; },
  };
}
