import type { LifecycleSession, LifecyclePorts } from "./lifecycle-types.js";
import type { LifecycleScope } from "./lifecycle-scope.js";
export function lifecycleMutations<Session extends LifecycleSession>(
  ports: LifecyclePorts<Session>,
  scope: LifecycleScope,
) {
  const pending = new Map<string, { kind: string; promise: Promise<void> }>();
  function enqueue(
    id: string,
    kind: string,
    request: ReturnType<LifecycleScope["request"]>,
    task: () => Promise<void>,
  ) {
    const previous = pending.get(id);
    if (previous?.kind === kind) {
      request.release();
      return previous.promise;
    }
    const record = {
      kind,
      promise: (previous?.promise.catch(() => {}) ?? Promise.resolve()).then(
        task,
      ),
    };
    pending.set(id, record);
    const complete = () => {
      if (pending.get(id) === record) pending.delete(id);
    };
    void record.promise.then(complete, complete);
    return record.promise;
  }
  function pause() {
    const session = ports.state.current;
    if (!session || session.state === "ended") return Promise.resolve();
    const request = scope.request(),
      elapsed = ports.duration();
    return enqueue(session.id, "pause", request, async () => {
      try {
        request.assert();
        const current =
          ports.state.current?.id === session.id
            ? ports.state.current
            : session;
        if (current.state === "ended") return;
        const paused = current.state === "paused";
        if (!paused) await ports.audio.stop();
        request.assert();
        const updated = await ports.request(
          `/sessions/${encodeURIComponent(session.id)}`,
          "PATCH",
          {
            state: paused ? "active" : "paused",
            elapsed: paused ? current.elapsed : elapsed,
          },
          request.signal,
        );
        request.assert();
        ports.state.sessions = ports.state.sessions.map((item) =>
          item.id === session.id ? updated : item,
        );
        if (request.selected() && ports.state.current?.id === session.id) {
          ports.state.current = updated;
          ports.state.elapsedBase = updated.elapsed;
          ports.state.started = paused ? ports.clock() : 0;
          if (!paused)
            ports.state.audioStatus = { microphone: "off", system: "off" };
          ports.render();
          if (paused) await ports.opened?.(session.id);
        }
        ports.broadcast({ type: "changed" });
      } finally {
        request.release();
      }
    });
  }
  function end() {
    ports.stopGaze();
    if (ports.state.view === "control") {
      ports.broadcast({ type: "command", action: "end" });
      return Promise.resolve();
    }
    const session = ports.state.current,
      request = scope.request(),
      elapsed = ports.duration();
    ports.cancelAnswer();
    return enqueue(session?.id ?? "none", "end", request, async () => {
      try {
        request.assert();
        await ports.audio.stop();
        request.assert();
        if (session && session.state !== "ended")
          await ports.request(
            `/sessions/${encodeURIComponent(session.id)}`,
            "PATCH",
            { state: "ended", elapsed },
            request.signal,
          );
        request.assert();
        ports.broadcast({ type: "changed" });
        if (!request.selected() || ports.state.current?.id !== session?.id)
          return;
        const state = ports.state;
        state.current = null;
        state.started = 0;
        state.elapsedBase = 0;
        state.audioStatus = { microphone: "off", system: "off" };
        ports.closeModal();
        await ports.sync();
        request.assert();
        if (!request.selected() || state.current !== null) return;
        if (ports.native) await ports.native.end();
        else {
          state.view = ports.ambientChat() ? "overlay" : "panel";
          state.page = "sessions";
          ports.replaceURL(
            ports.ambientChat()
              ? "/desktop.html?view=overlay"
              : "/desktop.html",
          );
        }
        request.assert();
        if (request.selected()) ports.render();
      } finally {
        request.release();
      }
    });
  }
  return {
    pause,
    end,
    reset() {
      pending.clear();
    },
  };
}
