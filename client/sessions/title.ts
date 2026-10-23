import type { SessionTitle, TitlePorts, TitleSave } from "./title-types.js";
import { savedTitle } from "./title-types.js";
export function createTitleEditor<Session extends SessionTitle>(
  ports: TitlePorts<Session>,
) {
  const pending = new WeakMap<HTMLInputElement, TitleSave>();
  const controllers = new Set<AbortController>();
  const operations = new Set<Promise<boolean>>();
  let version = 0,
    disposed = false;
  async function save(field: HTMLInputElement): Promise<boolean> {
    if (disposed) return false;
    const sessionId = field.dataset.session,
      value = field.value.trim(),
      existing = pending.get(field);
    if (existing && existing.version === version) {
      if (existing.value === value) return existing.promise;
      await existing.promise;
      if (existing.version !== version) return false;
      return save(field);
    }
    const current = ports.current();
    field.dataset.savedTitle ??=
      ports.sessions().find((session) => session.id === sessionId)?.title ??
      (current && current.id === sessionId
        ? current.title
        : field.getAttribute("value") || "");
    if (value === field.dataset.savedTitle) return true;
    if (!sessionId || !value || value.length > 200) {
      field.setAttribute("aria-invalid", "true");
      ports.toast("Use um título de 1 a 200 caracteres.");
      return false;
    }
    const controller = new AbortController(),
      started = version;
    controllers.add(controller);
    field.setAttribute("aria-busy", "true");
    const active = () =>
      !disposed && version === started && !controller.signal.aborted;
    const promise = Promise.resolve().then(async () => {
      try {
        controller.signal.throwIfAborted();
        const title = savedTitle(
          await ports.save(sessionId, value, controller.signal),
        );
        if (!active()) return false;
        field.dataset.savedTitle = title;
        if (field.value.trim() === value) field.value = title;
        field.removeAttribute("aria-invalid");
        const current = ports.current();
        if (current?.id === sessionId) current.title = title;
        ports.replace(
          ports
            .sessions()
            .map((session) =>
              session.id === sessionId ? { ...session, title } : session,
            ),
        );
        ports.changed();
        return true;
      } catch (error) {
        if (active()) {
          field.setAttribute("aria-invalid", "true");
          ports.toast(
            error instanceof Error
              ? error.message
              : "Não foi possível salvar o título.",
          );
        }
        return false;
      } finally {
        controllers.delete(controller);
        if (pending.get(field)?.controller === controller) {
          pending.delete(field);
          field.removeAttribute("aria-busy");
        }
      }
    });
    pending.set(field, { value, promise, controller, version: started });
    operations.add(promise);
    void promise.then(
      () => operations.delete(promise),
      () => operations.delete(promise),
    );
    return promise;
  }
  function reset() {
    version++;
    operations.clear();
    for (const controller of controllers) controller.abort();
    controllers.clear();
  }
  return {
    save,
    async settle() {
      const results = await Promise.all([...operations]);
      if (results.some((result) => !result))
        throw Error("Não foi possível salvar todos os títulos.");
    },
    reset,
    dispose() {
      disposed = true;
      reset();
    },
  };
}
