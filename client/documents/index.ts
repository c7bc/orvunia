import type {
  ReferenceMode,
  ReferencePorts,
  ImportedDocument,
} from "./contracts.js";
export { chooseReferenceFiles } from "./picker.js";
export function createReferenceImporter<Mode extends ReferenceMode>(
  ports: ReferencePorts<Mode>,
) {
  let version = 0,
    disposed = false;
  let pending: {
    workspace: string;
    modeId: string;
    controller: AbortController;
    promise: Promise<void>;
  } | null = null;
  function reset() {
    version++;
    pending?.controller.abort();
    pending = null;
  }
  function importFiles() {
    if (disposed) return Promise.resolve();
    const workspace = ports.workspace(),
      modeId = ports.modeId();
    if (pending?.workspace === workspace && pending.modeId === modeId)
      return pending.promise;
    reset();
    const current = version,
      controller = new AbortController();
    const active = () =>
      !disposed &&
      current === version &&
      workspace === ports.workspace() &&
      !controller.signal.aborted;
    const assertActive = () => {
      if (!active()) throw new DOMException("Interrupted", "AbortError");
    };
    const record = {
      workspace,
      modeId,
      controller,
      promise: Promise.resolve(),
    };
    record.promise = Promise.resolve().then(async () => {
      try {
        assertActive();
        let items: ImportedDocument[];
        if (ports.native) items = await ports.native.import();
        else {
          const files = await ports.choose(controller.signal);
          assertActive();
          if (files.length > 15) throw Error("Use até 15 arquivos por modo.");
          items = [];
          for (const file of files) {
            assertActive();
            if (file.size > 5 * 1024 * 1024)
              throw Error("Use arquivos de até 5 MB.");
            items.push(await ports.extract(file, workspace, controller.signal));
          }
        }
        assertActive();
        if (!items.length) return;
        const mode = ports.mode(modeId);
        if (!mode) throw Error("Este modo não está mais disponível.");
        if (mode.documents.length + items.length > 15)
          throw Error("Use até 15 arquivos por modo.");
        const documents = [
          ...mode.documents,
          ...items.map((item) => ({
            ...item,
            id: ports.identifier(),
            date: ports.clock().toISOString(),
          })),
        ];
        const updated = await ports.save(
          modeId,
          documents,
          workspace,
          controller.signal,
        );
        assertActive();
        ports.replace(updated);
        ports.changed();
        ports.render();
        ports.toast("Referências adicionadas ao modo.");
      } catch (error) {
        if (active()) throw error;
      } finally {
        if (pending === record) pending = null;
      }
    });
    pending = record;
    return record.promise;
  }
  return {
    importFiles,
    reset,
    dispose() {
      disposed = true;
      reset();
    },
  };
}
