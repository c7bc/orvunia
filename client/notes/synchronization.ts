import type { NoteState, NotesContext } from "./contracts";
import { noteFailure } from "./contracts";
export function noteSynchronization(context: NotesContext) {
  const clear = (identifier: number | null) => {
    if (identifier !== null) clearTimeout(identifier);
  };
  async function load(id: string, initial = ""): Promise<NoteState> {
    const state = context.get(id);
    if (state.loaded) {
      if (state.revision === 0 && !state.dirty && !state.saving)
        state.text = initial;
      return state;
    }
    if (state.loading) return state.loading;
    state.status = "loading";
    state.error = "";
    context.notify(state);
    state.loading = (async () => {
      try {
        const data = await context.request(id, "GET");
        if (!context.current(state)) return state;
        Object.assign(state, data, {
          text: data.revision === 0 ? initial : data.text,
          loaded: true,
          dirty: false,
          status: "idle",
          error: "",
        });
      } catch (error) {
        state.status = "error";
        state.error = noteFailure(error).message;
      } finally {
        state.loading = null;
        context.notify(state);
      }
      return state;
    })();
    return state.loading;
  }
  async function save(state: NoteState): Promise<NoteState> {
    clear(state.timer);
    state.timer = null;
    if (state.applying) await state.applying;
    if (
      !state.loaded ||
      !state.dirty ||
      state.conflict ||
      !context.current(state)
    )
      return state;
    if (state.saving) {
      await state.saving;
      return state.dirty && !state.conflict && !state.error
        ? save(state)
        : state;
    }
    const { text, revision } = state;
    state.status = "saving";
    state.error = "";
    clear(state.savedTimer);
    context.notify(state);
    state.saving = (async () => {
      try {
        const data = await context.request(state.id, "PATCH", {
          text,
          revision,
        });
        if (!context.current(state)) return;
        state.revision = data.revision;
        state.updatedAt = data.updatedAt;
        state.dirty = state.text !== text;
        state.status = state.dirty ? "unsaved" : "saved";
        if (state.dirty) context.schedule(state);
        else context.saved(state);
      } catch (error) {
        const failure = noteFailure(error);
        state.status = failure.code === "notes_conflict" ? "conflict" : "error";
        state.conflict =
          failure.code === "notes_conflict" ? failure.current : null;
        state.error = failure.message;
      } finally {
        state.saving = null;
        context.notify(state);
      }
    })();
    await state.saving;
    return state;
  }
  return { load, save };
}
