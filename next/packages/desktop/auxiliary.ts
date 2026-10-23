import type { NativeContext } from "./application-types.ts";
import type { PlatformInvocation } from "./platform-types.ts";
import type { PlatformContents, PlatformWindow } from "./platform-window.ts";
import { validateNativeInvocation } from "./native-security.ts";
import { auxiliaryAction } from "./auxiliary-contracts.ts";
import type { AuxiliaryAction } from "./auxiliary-contracts.ts";
import { auxiliaryBounds } from "./auxiliary-geometry.ts";
import { createAuxiliaryWindow } from "./auxiliary-window.ts";
import { chooseAuxiliaryFiles } from "./auxiliary-files.ts";

type Publication = Extract<AuxiliaryAction, { action: "publish" }>;
export function registerAuxiliarySurface(context: NativeContext) {
  let window: PlatformWindow | null = null, owner: PlatformContents | null = null;
  let publication: Publication | null = null, ready = false, observed: PlatformContents | null = null;
  function send(value: unknown) {
    if (owner && !owner.isDestroyed()) owner.send("cadence:auxiliary-event", value);
  }
  function hide() {
    publication = null;
    if (window && !window.isDestroyed()) {
      window.webContents.send("cadence:auxiliary-event", { action: "hide" }); window.hide();
    }
  }
  function place(height = window?.getContentSize()[1] ?? 400) {
    if (!window || !context.overlay || !publication) return;
    const anchor = context.overlay.getBounds();
    const area = context.electron.screen.getDisplayMatching(anchor).workArea;
    const bounds = auxiliaryBounds(anchor, area, publication.kind === "menu" ? 420 : 480, height);
    window.setContentSize(bounds.width, bounds.height);
    window.setPosition(bounds.x, bounds.y);
    window.setContentProtection(context.settings.protected);
  }
  function show() {
    if (!ready || !publication || !window || context.backgroundSmoke) return;
    place(); window.webContents.send("cadence:auxiliary-event", publication);
    if (!window.isVisible()) window.show();
  }
  function auxiliaryInvocation(request: PlatformInvocation) {
    const target = window?.webContents;
    return Boolean(target && request.sender === target && !target.isDestroyed()
      && request.senderFrame === target.mainFrame
      && request.senderFrame?.url === context.origin + "/auxiliary.html"
      && target.getURL() === context.origin + "/auxiliary.html");
  }
  context.electron.ipcMain.handle("cadence:auxiliary", (request, input) => {
    const value = auxiliaryAction.parse(input);
    if (value.action === "publish" || value.action === "hide" || value.action === "files") {
      const overlay = context.overlay?.webContents;
      validateNativeInvocation(request, context.origin, overlay ? [overlay] : []);
      if (value.action === "files") {
        if (context.abort.signal.aborted || context.quitting || context.backgroundSmoke)
          throw Error("auxiliary_closed");
        return chooseAuxiliaryFiles(context, window ?? context.overlay, value.accept, value.multiple);
      }
      if (value.action === "hide") { hide(); return { available: true }; }
      if (context.abort.signal.aborted || context.quitting || context.backgroundSmoke) throw Error("auxiliary_unavailable");
      owner = request.sender;
      if (observed !== owner) {
        observed = owner;
        context.overlay?.on("hide", hide);
        context.overlay?.on("move", () => place());
        owner.on("render-process-gone", hide);
        owner.on("did-start-navigation", (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) hide(); });
      }
      publication = value;
      if (!window || window.isDestroyed()) {
        ready = false;
        window = createAuxiliaryWindow(context, () => send({ action: "interact", type: "dismiss",
          documentId: publication?.documentId, revision: publication?.revision }));
        context.auxiliaryWindow = window;
        void window.loadURL(context.origin + "/auxiliary.html");
      }
      show(); return { available: true };
    }
    if (!auxiliaryInvocation(request)) throw Error("Origem inválida.");
    if (value.action === "ready") { ready = true; show(); return { available: true }; }
    if (!publication || !owner || owner.isDestroyed()) throw Error("auxiliary_closed");
    if (value.action === "resize") { place(value.height); return { resized: true }; }
    if (value.revision !== publication.revision || value.documentId !== publication.documentId) return { ignored: true };
    send(value); return { sent: true };
  });
  context.abort.signal.addEventListener("abort", () => {
    hide(); if (window && !window.isDestroyed()) window.destroy(); window = null; owner = null;
    context.auxiliaryWindow = null;
  }, { once: true });
}
