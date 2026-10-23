import type { LifecycleSession, LifecyclePorts } from "./lifecycle-types.js";
import type { LifecycleScope } from "./lifecycle-scope.js";
async function showAssistant<Session extends LifecycleSession>(
  ports: LifecyclePorts<Session>,
  session: Session,
) {
  if (ports.native)
    await ports.native.begin({ id: session.id, mode: session.mode });
  else {
    ports.state.view = "overlay";
    ports.replaceURL(
      `/desktop.html?view=overlay&session=${encodeURIComponent(session.id)}`,
    );
  }
}
export function lifecycleSelection<Session extends LifecycleSession>(
  ports: LifecyclePorts<Session>,
  scope: LifecycleScope,
) {
  let beginning: {
    owner: string;
    active(): boolean;
    promise: Promise<void>;
  } | null = null;
  function begin(modeId: string, title: string) {
    const owner = ports.workspace();
    if (beginning?.owner === owner && beginning.active())
      return beginning.promise;
    const request = scope.request(true);
    const record = {
      owner,
      active: request.selected,
      promise: Promise.resolve(),
    };
    record.promise = Promise.resolve().then(async () => {
      try {
        request.assert();
        const created = await ports.request(
          "/sessions",
          "POST",
          { mode: ports.base(modeId), modeId, title },
          request.signal,
        );
        request.assert();
        if (!request.selected())
          throw new DOMException("Interrupted", "AbortError");
        const state = ports.state;
        state.current = created;
        state.sessions = [
          created,
          ...state.sessions.filter((session) => session.id !== created.id),
        ];
        state.started = ports.clock();
        state.elapsedBase = 0;
        state.draft = "";
        state.tab = "answers";
        ports.closeModal();
        await showAssistant(ports, created);
        request.assert();
        if (!request.selected()) return;
        ports.broadcast({ type: "changed" });
        ports.render();
        await ports.opened?.(created.id);
      } finally {
        request.release();
        if (beginning === record) beginning = null;
      }
    });
    beginning = record;
    return record.promise;
  }
  async function activate(sessionId: string) {
    const request = scope.request(true);
    try {
      const session = await ports.request(
        `/sessions/${encodeURIComponent(sessionId)}`,
        "GET",
        undefined,
        request.signal,
      );
      request.assert();
      if (!request.selected()) return;
      ports.state.current = session;
      if (session.state === "ended") {
        ports.detail(session);
        return;
      }
      ports.state.started = session.state === "active" ? ports.clock() : 0;
      ports.state.elapsedBase = session.elapsed;
      ports.state.tab = "answers";
      await showAssistant(ports, session);
      request.assert();
      if (request.selected()) ports.render();
      if (request.selected() && session.state === "active")
        await ports.opened?.(session.id);
    } finally {
      request.release();
    }
  }
  return {
    begin,
    activate,
    reset() {
      beginning = null;
    },
  };
}
