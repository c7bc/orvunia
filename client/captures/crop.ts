import type { CaptureTarget, CropPorts, CropState } from "./contracts.js";
import { bindCropSelection } from "./selection.js";
import { cropCanvas, canvasJPEG } from "./canvas.js";
export function createCaptureCrop(ports: CropPorts) {
  let current: CropState | null = null,
    pending: { state: CropState; promise: Promise<void> } | null = null;
  function cancel() {
    current?.abort.abort();
    current?.unbind();
    current = null;
  }
  const active = (state: CropState) =>
    current === state &&
    !state.abort.signal.aborted &&
    ports.workspace() === state.workspace &&
    ports.document.querySelector("#crop-image") === state.image;
  function open(
    image: string,
    name: string,
    target: CaptureTarget | null = ports.current(),
  ) {
    cancel();
    ports.modal(
      "Selecionar contexto",
      `<p>Arraste sobre a imagem para selecionar uma região, ou use a captura inteira.</p><div class="crop-wrap"><img id="crop-image" src="${ports.escape(image)}" alt="${ports.escape(name)}"><div class="crop-selection" hidden></div></div><div class="form-footer">${ports.button("Cancelar", "modal-close")}${ports.button("Usar imagem inteira", "crop-full")}${ports.button("Usar região", "crop-save", "primary")}</div>`,
    );
    const wrap = ports.document.querySelector<HTMLElement>(".crop-wrap"),
      selection = ports.document.querySelector<HTMLElement>(".crop-selection"),
      node = ports.document.querySelector<HTMLImageElement>("#crop-image");
    if (!wrap || !selection || !node)
      throw Error("O seletor de região não está disponível.");
    const state: CropState = {
      image: node,
      name,
      target: target ? { ...target } : null,
      workspace: ports.workspace(),
      region: null,
      abort: new AbortController(),
      unbind: bindCropSelection(wrap, selection, (region) => {
        if (active(state)) state.region = region;
      }),
    };
    current = state;
  }
  function save(full: boolean) {
    const state = current;
    if (!state || !active(state)) return Promise.resolve();
    if (pending)
      return pending.state === state
        ? pending.promise
        : Promise.reject(Error("Conclua o salvamento em andamento."));
    const region = state.region ? { ...state.region } : null;
    if (!full && (!region || region.width < 10 || region.height < 10)) {
      ports.toast("Arraste para selecionar uma região.");
      return Promise.resolve();
    }
    const promise = Promise.resolve().then(async () => {
      try {
        if (!active(state)) return;
        const canvas = cropCanvas(ports.document, state.image, region, full),
          blob = await canvasJPEG(canvas, state.abort.signal);
        if (!active(state)) return;
        await ports.save(blob, state.name, state.target);
        if (active(state)) ports.close();
      } catch (error) {
        if (
          !state.abort.signal.aborted ||
          !(error instanceof DOMException) ||
          error.name !== "AbortError"
        )
          throw error;
      } finally {
        if (pending?.state === state) pending = null;
      }
    });
    pending = { state, promise };
    return promise;
  }
  return {
    open,
    save,
    cancel,
    settle: () => pending?.promise ?? Promise.resolve(),
    dispose: cancel,
  };
}
