import type { ListeningPorts } from "./listening-types.js";
import { runListening } from "./listening-run.js";
export function createListening(ports: ListeningPorts) {
  let version = 0,
    disposed = false,
    automaticSession: string | null = null,
    active: { id: string; workspace: string } | null = null,
    pending: { id: string; workspace: string; cancelled: boolean; promise: Promise<void> } | null =
      null;
  const needsSource = () => ports.settings().systemAudio && !ports.nativeSystemAudio?.() && !ports.hasSource();
  function start(): Promise<void> {
    const target = ports.current(),
      workspace = ports.workspace();
    if (disposed || ports.blocked() || !target || target.state !== "active")
      return Promise.resolve();
    if (pending) {
      if (pending.id === target.id && pending.workspace === workspace)
        return pending.promise;
      return pending.promise
        .catch(() => {})
        .then(() => {
          if (
            ports.current()?.id === target.id &&
            ports.workspace() === workspace
          )
            return start();
        });
    }
    if (
      active?.id === target.id &&
      active.workspace === workspace &&
      ports.audio.running
    )
      return Promise.resolve();
    const record = { id: target.id, workspace, cancelled: false, promise: Promise.resolve() };
    record.promise = Promise.resolve()
      .then(async () => {
        await ports.audio.stop();
        if (
          record.cancelled || disposed ||
          ports.blocked() ||
          ports.workspace() !== workspace ||
          ports.current()?.id !== target.id
        )
          return;
        const epoch = ++version,
          origin = ports.clock() - ports.duration() * 1000,
          stamp = {
            ...ports.context(),
            workspace,
            audioSessionId: target.id,
            audioTimeOrigin: origin,
          };
        active = { id: target.id, workspace };
        ports.began(target.id, origin);
        const alive = () =>
            !disposed && epoch === version && ports.workspace() === workspace,
          selected = () =>
            alive() && !record.cancelled &&
            !ports.blocked() &&
            ports.current()?.id === target.id &&
            ports.current()?.state === "active";
        await runListening(ports, target.id, stamp, selected, alive);
      })
      .finally(() => {
        if (pending === record) pending = null;
      });
    pending = record;
    return record.promise;
  }
  async function toggle() {
    if (disposed || ports.blocked()) return;
    if (ports.view() === "control") {
      ports.broadcast({ type: "command", action: "listen" });
      return;
    }
    if (ports.current()?.state !== "active") {
      ports.toast("Inicie ou retome uma sessão primeiro.");
      return;
    }
    if (ports.audio.running || pending) {
      const acquiring = pending;
      if (acquiring) { acquiring.cancelled = true; active = null; }
      await ports.audio.stop();
      if (acquiring) {
        await acquiring.promise.catch(() => {});
        version++;
      }
      ports.stopped();
      ports.render();
      return;
    }
    if (needsSource()) {
      await ports.chooseSource();
      return;
    }
    await start();
  }
  function reset() {
    version++;
    active = null;
    automaticSession = null;
    return ports.audio.stop();
  }
  return {
    start,
    toggle,
    async automatic(sessionId: string) {
      if (
        disposed || ports.blocked() || ports.settings().autoListen !== true ||
        ports.current()?.id !== sessionId || ports.current()?.state !== "active" ||
        ports.view() === "control"
      ) return;
      if (automaticSession === sessionId && needsSource()) return;
      automaticSession = sessionId;
      if (ports.audio.running || pending) return;
      if (needsSource()) {
        ports.state("system", "selecting", undefined, sessionId);
        await ports.chooseSource();
      } else await start();
    },
    async configure() {
      const session = ports.current();
      if (!session) return;
      const resume = ports.audio.running || Boolean(pending);
      const acquiring = Boolean(pending);
      if (acquiring) version++;
      active = null;
      await ports.audio.stop();
      await pending?.promise.catch(() => {});
      if (!acquiring) version++;
      for (const kind of ["microphone", "system"])
        ports.state(kind, "ended", undefined, session.id);
      if (resume && ports.current()?.id === session.id && session.state === "active") {
        if (needsSource())
          await ports.chooseSource();
        else await start();
      }
      ports.render();
    },
    reset,
    select(id: string | null) {
      if ((active && active.id !== id) || (pending && pending.id !== id)) {
        ports.stopped();
        return ports.audio.stop();
      }
      return Promise.resolve();
    },
    settle: () => pending?.promise ?? Promise.resolve(),
    dispose() {
      disposed = true;
      return reset();
    },
  };
}
