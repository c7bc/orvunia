import type { CropRegion } from "./contracts.js";
export function cropCanvas(
  document: Document,
  image: HTMLImageElement,
  region: CropRegion | null,
  full: boolean,
) {
  if (
    !image.naturalWidth ||
    !image.naturalHeight ||
    (!full && (!image.clientWidth || !region))
  )
    throw Error("Aguarde a imagem carregar antes de salvar.");
  const ratio = image.naturalWidth / image.clientWidth,
    canvas = document.createElement("canvas");
  canvas.width = full ? image.naturalWidth : Math.round(region!.width * ratio);
  canvas.height = full
    ? image.naturalHeight
    : Math.round(region!.height * ratio);
  const context = canvas.getContext("2d");
  if (!context) throw Error("Não foi possível preparar a imagem.");
  context.drawImage(
    image,
    full ? 0 : region!.x * ratio,
    full ? 0 : region!.y * ratio,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}
export function canvasJPEG(canvas: HTMLCanvasElement, signal: AbortSignal) {
  return new Promise<Blob>((resolve, reject) => {
    const interrupted = () =>
      finish(null, new DOMException("Interrupted", "AbortError"));
    function finish(blob: Blob | null, error?: unknown) {
      signal.removeEventListener("abort", interrupted);
      if (error) reject(error);
      else if (blob) resolve(blob);
      else reject(Error("Não foi possível preparar a imagem."));
    }
    if (signal.aborted) {
      interrupted();
      return;
    }
    signal.addEventListener("abort", interrupted, { once: true });
    try {
      canvas.toBlob((blob) => finish(blob), "image/jpeg", 0.88);
    } catch (error) {
      finish(null, error);
    }
  });
}
