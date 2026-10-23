import type { ApplicationState } from "./model.js";
import { applicationSession } from "./decoders.js";

export function createSessionSynchronization(ports: {
  state: ApplicationState;
  request(path: string): Promise<unknown>;
  generation(): number;
}) {
  const pending = new Map<string, { dirty: boolean; promise: Promise<void> }>();
  let disposed = false;
  function refresh(sessionId = ports.state.current?.id): Promise<void> {
    const { state } = ports;
    if (disposed || !sessionId || state.current?.id !== sessionId) return Promise.resolve();
    const workspace = state.workspaceKey, generation = ports.generation();
    const key = JSON.stringify([workspace, sessionId, generation]);
    const existing = pending.get(key);
    if (existing) { existing.dirty = true; return existing.promise; }
    const active = () => !disposed && state.workspaceKey === workspace &&
      state.current?.id === sessionId && ports.generation() === generation;
    const entry = { dirty: false, promise: Promise.resolve() };
    async function read() {
      try {
        const current = applicationSession(await ports.request("/sessions/" + sessionId));
        if (!active() || current.id !== sessionId) return;
        state.current = current;
        const index = state.sessions.findIndex(session => session.id === sessionId);
        if (index >= 0) state.sessions[index] = current;
      } catch (error) {
        if (!active()) return;
        if (error && typeof error === "object" && "status" in error && error.status === 404)
          state.current = null;
        else throw error;
      }
    }
    entry.promise = Promise.resolve().then(async () => {
      do { entry.dirty = false; await read(); } while (entry.dirty && active());
    });
    pending.set(key, entry);
    const clear = () => { if (pending.get(key) === entry) pending.delete(key); };
    void entry.promise.then(clear, clear);
    return entry.promise;
  }
  return { refresh, dispose() { disposed = true; pending.clear(); } };
}
