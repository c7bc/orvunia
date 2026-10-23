import { type BrowserContext, type LiveController } from "./contracts.js";

export function createCapturesMethods({
  state: browser,
  ports,
}: BrowserContext): Pick<LiveController, "capture" | "uploadImage"> {
  return {
    async capture(this: LiveController) {
      let stream;
      try {
        stream = await ports.media.getDisplayMedia({
          video: true,
          audio: false,
        });
        const video = ports.document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        await video.play();
        const canvas = ports.document.createElement("canvas"),
          scale = Math.min(1, 1600 / video.videoWidth);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        canvas
          .getContext("2d")!
          .drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.85),
        );
        stream.getTracks().forEach((t) => t.stop());
        await this.uploadImage(blob);
        browser.inputTab = "captures";
        ports.renderInput();
        ports.toast("Captura adicionada ao contexto.");
      } catch (error) {
        this.reportError(error);
      } finally {
        stream?.getTracks().forEach((t) => t.stop());
      }
    },
    async uploadImage(this: LiveController, blob: Blob | null) {
      if (!blob || blob.size > 4 * 1024 * 1024)
        throw new Error("Use uma imagem de até 4 MB.");
      const id = await this.ensureSession(),
        body = new FormData();
      body.append(
        "file",
        blob,
        blob.type === "image/png"
          ? "capture.png"
          : blob.type === "image/webp"
            ? "capture.webp"
            : "capture.jpg",
      );
      await ports.api.request("/sessions/" + id + "/captures", {
        method: "POST",
        body,
      });
      await this.refreshSession();
    },
  };
}
