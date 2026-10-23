import type { RepositoryAgentJob, RepositoryBinding, RepositoryIdentity,
  RepositoryToolCall, RepositoryUserState } from "./contracts.js";
import { decodeRepositoryIdentity, decodeRepositoryPreview } from "./decoder.js";
import { repositoryMessage } from "./messages.js";
import { executeRepositoryTool } from "./native-tools.js";
import { record } from "../legacy-web/validation.js";

export function createRepositoryController(ports: {
  current(): { workspaceId: string; sessionId: string } | null;
  native(value: unknown): Promise<unknown>;
  binding(sessionId: string, signal: AbortSignal): Promise<unknown>;
  locale(): string;
  changed(state: RepositoryUserState): void;
  disconnected?(): Promise<void>;
  onText?(text: string): void;
  agent(options: {
    execute(call: RepositoryToolCall, binding: RepositoryBinding, signal: AbortSignal): Promise<unknown>;
    onChange(job: RepositoryAgentJob): void;
    onText(text: string): void;
  }): {
    run(sessionId: string, question: string, binding: RepositoryBinding,
      signal: AbortSignal, sourceTranscriptIds?: readonly string[]): Promise<RepositoryAgentJob>;
    cancel(sessionId: string, jobId: string): Promise<unknown>;
  };
}) {
  const state: RepositoryUserState = {
    identity: null, preview: null, question: "", job: null, busy: false, error: "",
  };
  let controller: AbortController | null = null, disposed = false, version = 0;
  const pending = new Set<Promise<unknown>>();
  const changed = () => { if (!disposed) ports.changed(state); };
  function assertCurrent(identity: RepositoryIdentity) {
    const current = ports.current();
    if (!current || current.sessionId !== identity.sessionId || current.workspaceId !== identity.workspaceId)
      throw Error("repository_session_changed");
  }
  const agent = ports.agent({
    onText(text) {
      if (disposed || !state.busy || controller?.signal.aborted || !state.identity) return;
      try { assertCurrent(state.identity); } catch { return; }
      ports.onText?.(text);
    },
    async execute(call, binding, signal) {
      const identity = state.identity;
      if (!identity) throw Error("repository_consent_required");
      assertCurrent(identity);
      return executeRepositoryTool(ports.native, identity, binding, call, signal);
    },
    onChange(job) {
      if (disposed || controller?.signal.aborted || !state.identity) return;
      try { assertCurrent(state.identity); } catch { return; }
      state.job = job;
      if (job.error === "repository_provider_limit") state.error = repositoryMessage(ports.locale(), "limited");
      changed();
      if (job.status === "waiting_tools") ports.onText?.("");
    },
  });
  async function execute<T>(operation: (signal: AbortSignal) => Promise<T>) {
    if (disposed || state.busy) throw Error("repository_busy");
    const epoch = ++version;
    controller = new AbortController();
    state.busy = true; state.error = ""; changed();
    try { return await operation(controller.signal); }
    catch (error) {
      if (epoch === version && !disposed) {
        const code = error instanceof Error && /^repository_[a-z_]+$/.test(error.message) ? error.message : "";
        state.error = error && typeof error === "object" && "code" in error && error.code === "provider_limit"
          ? repositoryMessage(ports.locale(), "limited")
          : repositoryMessage(ports.locale(), "error") + (code ? ` (${code})` : "");
      }
      throw error;
    } finally {
      if (epoch === version) { state.busy = false; controller = null; changed(); }
    }
  }
  function run<T>(operation: (signal: AbortSignal) => Promise<T>) {
    const task = execute(operation);
    pending.add(task);
    const remove = () => pending.delete(task);
    void task.then(remove, remove);
    return task;
  }
  async function command(action: string, extra: object = {}) {
    if (!state.identity) throw Error("repository_consent_required");
    assertCurrent(state.identity);
    const binding = state.preview && { grantId: state.preview.grantId,
      revision: state.preview.revision, snapshotSha256: state.preview.snapshotSha256 };
    return ports.native({ action, ...state.identity, ...binding, ...extra });
  }
  return {
    state,
    isApproved() {
      if (!state.identity || !state.preview?.approved) return false;
      try { assertCurrent(state.identity); return true; } catch { return false; }
    },
    select(scope: string[], preparedModeId?: string) {
      return run(async (signal) => {
        state.preview = null; state.job = null;
        const current = ports.current();
        if (!current) throw Error("repository_session_changed");
        const identity = decodeRepositoryIdentity(await ports.binding(current.sessionId,
          AbortSignal.any([signal, AbortSignal.timeout(8_000)])));
        signal.throwIfAborted();
        assertCurrent(identity);
        state.identity = identity;
        const selected = await ports.native(preparedModeId
          ? { action: "select-prepared", ...identity, modeId: preparedModeId }
          : { action: "select", ...identity, scope, noticeVersion: 1 });
        signal.throwIfAborted(); assertCurrent(identity);
        if (record(selected).canceled === true) return;
        state.preview = decodeRepositoryPreview(selected);
        const preview = await command("preview");
        signal.throwIfAborted(); assertCurrent(identity);
        state.preview = decodeRepositoryPreview(preview);
      });
    },
    approve() {
      return run(async (signal) => {
        const preview = await command("approve", { consent: true });
        signal.throwIfAborted();
        if (state.identity) assertCurrent(state.identity);
        state.preview = decodeRepositoryPreview(preview);
      });
    },
    refresh() {
      return run(async (signal) => {
        const refreshed = await command("refresh");
        signal.throwIfAborted();
        if (state.identity) assertCurrent(state.identity);
        state.preview = decodeRepositoryPreview(refreshed);
        const preview = await command("preview");
        signal.throwIfAborted();
        if (state.identity) assertCurrent(state.identity);
        state.preview = decodeRepositoryPreview(preview);
      });
    },
    revoke() {
      return run(async () => {
        await command("revoke"); state.preview = null; state.job = null;
        await ports.disconnected?.();
      });
    },
    ask(question: string, signal?: AbortSignal, sourceTranscriptIds?: readonly string[]) {
      return run(async (ownSignal) => {
        if (!state.identity || !state.preview?.approved || !question.trim())
          throw Error("repository_consent_required");
        ownSignal.throwIfAborted(); assertCurrent(state.identity);
        state.question = question;
        const result = await agent.run(state.identity.sessionId, question,
          { grantId: state.preview.grantId, revision: state.preview.revision,
            snapshotSha256: state.preview.snapshotSha256 },
          signal ? AbortSignal.any([signal, ownSignal]) : ownSignal, sourceTranscriptIds);
        ownSignal.throwIfAborted(); signal?.throwIfAborted();
        assertCurrent(state.identity);
        state.job = result;
        return result;
      });
    },
    async cancel() {
      controller?.abort();
      const tasks: Promise<unknown>[] = [];
      if (state.identity) tasks.push(ports.native({ action: "cancel", ...state.identity }));
      if (state.identity && state.job) tasks.push(agent.cancel(state.identity.sessionId, state.job.id));
      await Promise.allSettled(tasks);
      await Promise.allSettled([...pending]);
      state.preview = null;
    },
    async settle() { while (pending.size) await Promise.allSettled([...pending]); },
    dispose() {
      disposed = true; version++; controller?.abort();
      if (state.identity) void ports.native({ action: "cancel", ...state.identity }).catch(() => {});
    },
  };
}
