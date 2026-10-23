import { preparationMessage } from "./preparation-messages.js";
import { renderModeRepository, type PreparedRepository } from "./preparation-view.js";
import { decodeRepositoryPreview } from "./decoder.js";
import { record } from "../legacy-web/validation.js";
import { readRepositoryScope } from "./scope.js";
import { renderRepositoryPreview } from "./preview.js";

export function createRepositoryPreparation(ports: {
  document: Document; native: boolean; workspace(): string; locale(): string;
  invoke(value: unknown): Promise<unknown>; changed(): void;
  modal(title: string, content: string, className?: string): void; toast(message: string): void;
  escape(value: unknown): string; icon(name: string, size: number): string;
}) {
  const cache = new Map<string, PreparedRepository | null>();
  const pending = new Map<string, Promise<unknown>>();
  const loading = new Map<string, Promise<unknown>>();
  const selecting = new Set<string>();
  const scope = new AbortController();
  let generation = 0;
  const t = (key: Parameters<typeof preparationMessage>[1]) => preparationMessage(ports.locale(), key);
  const key = (modeId: string) => JSON.stringify([ports.workspace(), modeId]);
  function decode(modeId: string, value: unknown): PreparedRepository | null {
    if (value === null || record(value).canceled === true) return null;
    const item = record(value);
    if (item.modeId !== modeId || typeof item.name !== "string" || !item.name || item.name.length > 240)
      throw Error("repository_response_invalid");
    return { modeId, name: item.name, preview: decodeRepositoryPreview(item.preview), authorized: item.authorized === true };
  }
  async function status(modeId: string) {
    const owner = key(modeId), epoch = generation;
    const value = decode(modeId, await ports.invoke({ preparation: "status", modeId }));
    if (scope.signal.aborted || epoch !== generation || owner !== key(modeId)) return null;
    cache.set(owner, value);
    return value;
  }
  function review(prepared: PreparedRepository) {
    ports.modal(t("selected"), `${renderRepositoryPreview(prepared.preview, {
      locale: ports.locale(), escape: ports.escape, name: prepared.name, content: false,
    })}<p class="repository-preview-note">${ports.escape(t("lifetime"))}</p>
    <div class="form-footer"><button type="button" class="btn primary" data-action="modal-close">${ports.escape(t("done"))}</button></div>`, "repository-preparation-dialog");
  }
  function tracked(owner: string, operation: () => Promise<unknown>) {
    if (pending.has(owner)) return;
    const epoch = generation;
    const task = operation().catch(() => { if (epoch === generation && !scope.signal.aborted) ports.toast(t("error")); })
      .finally(() => pending.delete(owner));
    pending.set(owner, task);
  }
  function select(modeId: string, paths: string[]) {
    tracked(key(modeId), async () => {
      selecting.add(modeId);
      try {
        const owner = key(modeId), epoch = generation;
        await loading.get(owner);
        if (epoch !== generation || owner !== key(modeId) || scope.signal.aborted) return;
        const value = await ports.invoke({ preparation: "select", modeId, scope: paths, noticeVersion: 1 });
        if (epoch !== generation || owner !== key(modeId) || scope.signal.aborted) return;
        if (record(value).canceled === true) return;
        const prepared = decode(modeId, value);
        cache.set(owner, prepared); ports.changed();
      } finally { selecting.delete(modeId); }
    });
  }
  const click = (event: Event) => {
    const target = event.target;
    if (!(target instanceof ports.document.defaultView!.Element)) return;
    const button = target.closest<HTMLElement>("[data-repository-preparation]");
    const modeId = button?.dataset.modeId;
    if (!button || !modeId) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const action = button.dataset.repositoryPreparation;
    if (action === "info") { ports.modal(t("info"), `<p>${ports.escape(t("explanation"))}</p><p>${ports.escape(t("lifetime"))}</p>`); return; }
    if (!ports.native) { ports.toast(t("unavailable")); return; }
    if (action === "select") {
      select(modeId, readRepositoryScope(button.closest("[data-component=mode-repository]")));
    } else if (action === "review") {
      const prepared = cache.get(key(modeId)); if (prepared) review(prepared);
    } else if (action === "remove") tracked(key(modeId), () => remove(modeId));
  };
  async function remove(modeId: string) {
    const owner = key(modeId), epoch = generation;
    await loading.get(owner);
    if (epoch !== generation || owner !== key(modeId)) return;
    await ports.invoke({ preparation: "remove", modeId });
    if (epoch !== generation || owner !== key(modeId)) return;
    cache.set(owner, null); ports.changed();
  }
  ports.document.addEventListener("click", click, true);
  async function cancel() {
    generation++;
    await Promise.all([...selecting].map(modeId => ports.invoke({ preparation: "cancel", modeId })));
  }
  return {
    status,
    remove,
    cancel,
    render(modeId: string) {
      const owner = key(modeId);
      if (ports.native && !cache.has(owner) && !loading.has(owner)) {
        cache.set(owner, null);
        const epoch = generation;
        const task = status(modeId).then(() => { if (epoch === generation && !scope.signal.aborted) ports.changed(); })
          .catch(() => {}).finally(() => loading.delete(owner));
        loading.set(owner, task);
      }
      return renderModeRepository({ ...ports, modeId, locale: ports.locale(), prepared: cache.get(owner) ?? null });
    },
    reset() { generation++; cache.clear(); },
    async settle() {
      while (pending.size || loading.size) await Promise.allSettled([...pending.values(), ...loading.values()]);
    },
    dispose() {
      void cancel().catch(() => {}); scope.abort(); cache.clear();
      ports.document.removeEventListener("click", click, true);
    },
  };
}
