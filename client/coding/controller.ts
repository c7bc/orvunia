import type {
  ExpansionOptions,
  ExpansionState,
  ExpansionValue,
} from "./expansion";
import { expansionPath } from "./expansion";
import { prepareExpansion } from "./prepare";

export function createTellMoreController({
  request,
  onChange = () => {},
  onReveal = async () => {},
  pollMs = 1000,
  timeoutMs = 70000,
  maxEntries = 64,
}: ExpansionOptions) {
  const records = new Map<string, ExpansionState>();
  let active: ExpansionState | null = null;
  let epoch = 0,
    disposed = false;
  const key = (session: string, id: string) => session + ":" + id;
  const fresh = (
    sessionId: string,
    sourceResponseId: string,
  ): ExpansionState => ({
    sessionId,
    sourceResponseId,
    status: "absent",
    requestId: null,
    showWhenDone: false,
    error: "",
  });
  const emit = (state: ExpansionState) => {
    const {
      controller: _controller,
      promise: _promise,
      ...publicState
    } = state;
    if (!disposed) onChange(publicState);
  };
  const get = (sessionId: string, sourceResponseId: string) =>
    records.get(key(sessionId, sourceResponseId)) ??
    fresh(sessionId, sourceResponseId);
  const put = (sessionId: string, sourceResponseId: string) => {
    const name = key(sessionId, sourceResponseId),
      existing = records.get(name);
    if (existing) return existing;
    while (records.size >= maxEntries) {
      const candidate = [...records].find(([, value]) => !value.promise);
      if (!candidate) throw Error("Aguarde o aprofundamento em andamento.");
      records.delete(candidate[0]);
    }
    const state = fresh(sessionId, sourceResponseId);
    records.set(name, state);
    return state;
  };
  const apply = (state: ExpansionState, value: ExpansionValue) => {
    state.status = value.status;
    if (value.requestId !== undefined) state.requestId = value.requestId;
    if (value.captureIds !== undefined) state.captureIds = value.captureIds;
    if (value.contextSource !== undefined)
      state.contextSource = value.contextSource;
    if (value.cancelled !== undefined) state.cancelled = value.cancelled;
    if (value.response) state.responseId = value.response.id;
    emit(state);
  };
  async function reveal(state: ExpansionState, signal: AbortSignal) {
    const revealEpoch = epoch;
    const value = await request(
      expansionPath(state) + "/reveal",
      "POST",
      { requestId: state.requestId },
      signal,
    );
    if (signal.aborted || revealEpoch !== epoch || disposed)
      throw new DOMException("Interrupted", "AbortError");
    apply(state, value);
    if (value.response)
      await onReveal(value.response, {
        sessionId: state.sessionId,
        sourceResponseId: state.sourceResponseId,
      });
    return value;
  }
  async function cancelActive() {
    const state = active;
    if (!state) return;
    state.showWhenDone = false;
    state.controller?.abort();
    const value = await request(expansionPath(state), "GET");
    apply(state, value);
    if (value.status === "generating")
      apply(
        state,
        await request(expansionPath(state) + "/cancel", "POST", {
          requestId: value.requestId || state.requestId,
        }),
      );
    await state.promise?.catch(() => {});
  }
  async function prepare(
    sessionId: string,
    sourceResponseId: string,
    { show = false } = {},
  ) {
    if (disposed) throw Error("O painel foi fechado.");
    const state = put(sessionId, sourceResponseId);
    state.showWhenDone ||= show;
    if (state.promise) return state.promise;
    if (state.status === "expired")
      throw Error(
        "O contexto original expirou ou não está mais disponível. Faça uma nova pergunta com o contexto atual.",
      );
    if (active && active !== state) await cancelActive();
    const controller = new AbortController(),
      runEpoch = epoch;
    state.controller = controller;
    active = state;
    state.promise = prepareExpansion(state, controller, show, {
      request,
      apply,
      reveal,
      onReveal,
      emit,
      pollMs,
      timeoutMs,
      isCurrent: () => runEpoch === epoch,
    }).finally(() => {
      if (state.controller === controller) {
        state.controller = null;
        state.promise = null;
      }
      if (active === state) active = null;
    });
    return state.promise;
  }
  const reset = () => {
    epoch++;
    for (const state of records.values()) state.controller?.abort();
    records.clear();
    active = null;
  };
  return {
    get,
    prepare,
    open: (session: string, id: string) => prepare(session, id, { show: true }),
    cancelActive,
    stats: () => ({
      entries: records.size,
      active: active ? 1 : 0,
      limit: maxEntries,
    }),
    reset,
    dispose() {
      reset();
      disposed = true;
    },
  };
}
