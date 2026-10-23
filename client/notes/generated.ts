import type { GeneratedNote, NoteState, NotesContext } from "./contracts";
export function generatedNotes(
  context: NotesContext,
  save: (state: NoteState) => Promise<NoteState>,
) {
  const changed = () =>
    Error(
      "O resumo foi gerado, mas suas notas foram alteradas. Suas edições foram preservadas.",
    );
  return {
    async prepareGenerated(id: string): Promise<GeneratedNote> {
      const state = context.get(id);
      if (state.loading) await state.loading;
      if (state.applying) await state.applying;
      if (!state.loaded)
        throw Error("Carregue suas notas antes de gerar um novo resumo.");
      await save(state);
      if (!context.current(state))
        throw new DOMException("Interrupted", "AbortError");
      if (state.dirty || state.conflict || state.error)
        throw Error(
          "Salve ou resolva suas notas antes de gerar um novo resumo.",
        );
      return Object.freeze({
        id,
        revision: state.revision,
        text: state.text,
        edits: state.edits,
      });
    },
    async applyGenerated(id: string, text: string, token: GeneratedNote) {
      const state = context.get(id);
      const unchanged = () =>
        context.current(state) &&
        token?.id === id &&
        state.loaded &&
        state.revision === token.revision &&
        state.text === token.text &&
        state.edits === token.edits &&
        !state.dirty &&
        !state.conflict;
      if (!unchanged()) throw changed();
      let failure: unknown;
      state.status = "saving";
      context.notify(state);
      state.applying = (async () => {
        try {
          const data = await context.request(id, "PATCH", {
            text,
            revision: token.revision,
          });
          if (!context.current(state)) {
            failure = new DOMException("Interrupted", "AbortError");
            return;
          }
          if (!unchanged()) {
            state.revision = data.revision;
            state.updatedAt = data.updatedAt;
            if (state.dirty) context.schedule(state);
            failure = changed();
            return;
          }
          Object.assign(state, data, {
            dirty: false,
            status: "saved",
            error: "",
          });
          context.saved(state);
        } catch (error) {
          failure = error;
          state.status = state.dirty ? "unsaved" : "idle";
        } finally {
          state.applying = null;
          context.notify(state);
        }
      })();
      await state.applying;
      if (failure) throw failure;
      return state;
    },
  };
}
