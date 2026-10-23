import type { CodingState } from "./domain";

export function codingRegistry(
  maxSessions: number,
  revokeURL: (url: string) => void,
) {
  const sessions = new Map<string, CodingState>();
  let generation = 0;
  const fresh = (): CodingState => ({
    problem: "",
    code: "",
    language: "",
    captures: [],
    flushing: null,
    attempt: null,
    responseCaptures: new Map(),
    prefetchTellMore: false,
  });
  const get = (id: string) => {
    if (!id)
      throw Error("Inicie uma sessão antes de preparar o contexto técnico.");
    return sessions.get(id) ?? fresh();
  };
  const reserve = (id: string) => {
    const existing = get(id);
    if (sessions.has(id)) {
      sessions.delete(id);
      sessions.set(id, existing);
      return existing;
    }
    for (const [key, state] of sessions) {
      if (sessions.size < maxSessions) break;
      if (
        !state.problem &&
        !state.code &&
        !state.language &&
        !state.captures.length &&
        !state.attempt &&
        !state.flushing &&
        !state.prefetchTellMore
      )
        sessions.delete(key);
    }
    if (sessions.size >= maxSessions)
      throw Error(
        "Há muitos rascunhos técnicos abertos. Descarte um rascunho antigo antes de preparar outro.",
      );
    sessions.set(id, existing);
    return existing;
  };
  const pendingBytes = () =>
    [...sessions.values()].reduce(
      (sum, state) =>
        sum +
        state.captures.reduce(
          (bytes, item) => bytes + (item.blob?.size ?? 0),
          0,
        ),
      0,
    );
  const remove = (state: CodingState, id: string) => {
    const item = state.captures.find((capture) => capture.id === id);
    if (item?.ownsPreview) revokeURL(item.preview);
    state.captures = state.captures.filter((capture) => capture.id !== id);
  };
  const clear = (id: string) => {
    const state = sessions.get(id);
    if (!state) return;
    for (const item of state.captures)
      if (item.ownsPreview) revokeURL(item.preview);
    sessions.delete(id);
  };
  return {
    get,
    reserve,
    pendingBytes,
    remove,
    clear,
    generation: () => generation,
    stats: () => ({
      sessions: sessions.size,
      pendingBytes: pendingBytes(),
      responseRefs: [...sessions.values()].reduce(
        (sum, state) => sum + state.responseCaptures.size,
        0,
      ),
    }),
    dispose() {
      generation++;
      for (const id of [...sessions.keys()]) clear(id);
    },
  };
}
export type CodingRegistry = ReturnType<typeof codingRegistry>;
