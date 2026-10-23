import type { NoteState, NotesOptions, NotesContext } from "./contracts";
import { noteSynchronization } from "./synchronization";
import { generatedNotes } from "./generated";
export function createSessionNotesClient({
  request,
  delay = 700,
  savedDuration = 2000,
  onChange = () => {},
}: NotesOptions) {
  const records = new Map<string, NoteState>();
  let disposed = false;
  function get(id: string): NoteState {
    let record = records.get(id);
    if (!record) {
      record = {
        id,
        text: "",
        revision: 0,
        updatedAt: null,
        loaded: false,
        dirty: false,
        status: "loading",
        error: "",
        conflict: null,
        loading: null,
        saving: null,
        applying: null,
        timer: null,
        savedTimer: null,
        edits: 0,
      };
      records.set(id, record);
    }
    return record;
  }
  const clear = (identifier: number | null) => {
    if (identifier !== null) clearTimeout(identifier);
  };
  const context: NotesContext = {
    request,
    get,
    current: (state) => !disposed && records.get(state.id) === state,
    notify(state) {
      if (context.current(state)) onChange(state.id, state);
    },
    schedule(state) {
      if (!context.current(state)) return;
      clear(state.timer);
      state.timer = setTimeout(() => {
        state.timer = null;
        void synchronization.save(state);
      }, delay);
    },
    saved(state) {
      if (!context.current(state)) return;
      clear(state.savedTimer);
      state.savedTimer = setTimeout(() => {
        if (state.status === "saved") {
          state.status = "idle";
          context.notify(state);
        }
      }, savedDuration);
    },
  };
  const synchronization = noteSynchronization(context);
  return {
    load: synchronization.load,
    get,
    edit(id: string, text: string) {
      const state = get(id);
      if (!state.loaded || disposed) return;
      state.text = text;
      state.dirty = true;
      state.error = "";
      state.edits++;
      state.status = state.conflict ? "conflict" : "unsaved";
      clear(state.savedTimer);
      if (!state.conflict) context.schedule(state);
      context.notify(state);
    },
    flush: (id: string) => synchronization.save(get(id)),
    useServer(id: string) {
      const state = get(id);
      if (!state.conflict) return;
      clear(state.timer);
      Object.assign(state, state.conflict, {
        conflict: null,
        dirty: false,
        status: "idle",
        error: "",
      });
      context.notify(state);
    },
    async keepMine(id: string) {
      const state = get(id);
      if (!state.conflict) return state;
      state.revision = state.conflict.revision;
      state.conflict = null;
      state.dirty = true;
      state.error = "";
      return synchronization.save(state);
    },
    value: (id: string) =>
      records.get(id)?.loaded ? records.get(id)?.text : undefined,
    ...generatedNotes(context, synchronization.save),
    async flushAll() {
      await Promise.allSettled(
        [...records.values()]
          .filter((state) => state.dirty)
          .map(synchronization.save),
      );
    },
    async settle() {
      await Promise.all(
        [...records.values()]
          .filter((state) => state.dirty || state.saving || state.applying)
          .map(synchronization.save),
      );
      if (
        [...records.values()].some(
          (state) => state.dirty || state.saving || state.applying,
        )
      )
        throw Error(
          "Não foi possível salvar todas as notas. Revise as alterações antes de sair.",
        );
    },
    reset() {
      for (const state of records.values()) {
        clear(state.timer);
        clear(state.savedTimer);
      }
      records.clear();
    },
    dispose() {
      disposed = true;
      for (const state of records.values()) {
        clear(state.timer);
        clear(state.savedTimer);
      }
      records.clear();
    },
  };
}
export type SessionNotesClient = ReturnType<typeof createSessionNotesClient>;
