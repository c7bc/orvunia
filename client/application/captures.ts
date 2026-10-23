import type { ApplicationState } from "./model.js";
import type { ApplicationNative, NativeSource } from "./native.js";
import type { CaptureTarget } from "../captures/contracts.js";
import { createCaptureCrop } from "../captures/crop.js";
import { canvasJPEG } from "../captures/canvas.js";

export function createApplicationCaptures(ports: {
  state: ApplicationState;
  document: Document;
  native: ApplicationNative | null;
  fetch(url: string): Promise<Response>;
  display(options: DisplayMediaStreamOptions): Promise<MediaStream>;
  escape(value: unknown): string;
  button(label: string, action: string, style?: string): string;
  modal(title: string, content: string, className?: string): void;
  close(): void;
  toast(message: string): void;
  startAudio(): Promise<unknown>;
  save(
    blob: Blob,
    name: string,
    target: CaptureTarget | null,
    workspace?: string,
  ): Promise<unknown>;
}) {
  const { state, document } = ports;
  let sources: NativeSource[] = [],
    disposed = false;
  const target = (): CaptureTarget | null =>
    state.current && {
      id: state.current.id,
      mode: state.current.mode,
      state: state.current.state,
    };
  const crop = createCaptureCrop({
    document,
    workspace: () => state.workspaceKey,
    current: target,
    escape: ports.escape,
    button: ports.button,
    modal: ports.modal,
    close: ports.close,
    toast: ports.toast,
    save: ports.save,
  });
  async function captureBrowser(shouldCrop = false) {
    if (state.captureInProgress || document.querySelector("#crop-image"))
      throw Error(
        "Conclua a captura ou o recorte em andamento antes de capturar novamente.",
      );
    const selected = target(),
      workspace = state.workspaceKey;
    state.captureInProgress = true;
    let stream: MediaStream | undefined;
    try {
      stream = await ports.display({ video: true, audio: false });
      if (disposed || workspace !== state.workspaceKey) return;
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      if (disposed || workspace !== state.workspaceKey) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) throw Error("Não foi possível preparar a captura.");
      context.drawImage(video, 0, 0);
      if (shouldCrop) {
        crop.open(
          canvas.toDataURL("image/jpeg", 0.9),
          "Tela compartilhada",
          selected,
        );
        return;
      }
      const blob = await canvasJPEG(canvas, new AbortController().signal);
      if (!disposed && workspace === state.workspaceKey)
        await ports.save(blob, "Tela compartilhada", selected, workspace);
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      state.captureInProgress = false;
    }
  }
  async function chooseSource(purpose = "capture") {
    if (!ports.native) {
      if (purpose === "audio") {
        state.desktop.settings.systemAudio = false;
        await ports.startAudio();
      } else await captureBrowser(purpose === "capture-region");
      return;
    }
    const workspace = state.workspaceKey;
    const title =
      purpose === "audio"
        ? "Escolha a tela da reunião"
        : "Capturar tela ou janela";
    ports.modal(title, "<p>Carregando fontes disponíveis…</p>");
    const loaded = await ports.native.sources();
    if (disposed || workspace !== state.workspaceKey) return;
    sources = loaded;
    ports.modal(
      title,
      `<p style="margin-bottom:16px">${purpose === "audio" ? "O áudio do computador será capturado separadamente do microfone." : purpose === "capture-region" ? "Escolha uma fonte para recortar o enunciado." : "A tela ou janela selecionada será capturada inteira."}</p><div class="source-grid">${sources
        .filter(
          (source) => purpose !== "audio" || source.id.startsWith("screen:"),
        )
        .map(
          (source) =>
            `<button class="source-choice" data-source="${ports.escape(source.id)}" data-purpose="${ports.escape(purpose)}"><img src="${ports.escape(source.image)}" alt="Prévia da fonte"><small>${ports.escape(source.name)}</small></button>`,
        )
        .join("")}</div>`,
    );
  }
  async function capture(sourceId: string, shouldCrop = false) {
    if (!ports.native) return captureBrowser(shouldCrop);
    if (state.captureInProgress || document.querySelector("#crop-image"))
      throw Error(
        "Conclua a captura ou o recorte em andamento antes de capturar novamente.",
      );
    const selected = target(),
      workspace = state.workspaceKey;
    state.captureInProgress = true;
    try {
      const shot = await ports.native.capture(sourceId);
      if (disposed || workspace !== state.workspaceKey) return;
      if (shouldCrop) {
        crop.open(shot.image, shot.name, selected);
        return;
      }
      const blob = await (await ports.fetch(shot.image)).blob();
      if (!disposed && workspace === state.workspaceKey)
        await ports.save(blob, shot.name, selected, workspace);
    } finally {
      state.captureInProgress = false;
    }
  }
  return {
    crop,
    chooseSource,
    capture,
    captureBrowser,
    sources: () => sources,
    dispose() {
      disposed = true;
      sources = [];
      crop.dispose();
    },
  };
}
