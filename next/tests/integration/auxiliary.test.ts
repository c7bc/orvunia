import { expect, test } from "bun:test";
import { registerAuxiliarySurface } from "../../packages/desktop/auxiliary.ts";
import type { NativeContext } from "../../packages/desktop/application-types.ts";
import type { PlatformInvocation } from "../../packages/desktop/platform-types.ts";

function fixture() {
  const origin = "https://orvunia.example", sent: { channel: string; value: unknown }[] = [];
  let invoke!: (request: PlatformInvocation, value: unknown) => unknown;
  class Window {
    visible = false; protected = false; destroyed = false;
    bounds = { x: 100, y: 100, width: 540, height: 140 };
    events = new Map<string, (...args: unknown[]) => void>();
    url = origin + "/desktop.html?view=overlay";
    frame = { url: this.url };
    webContents = { id: 1, mainFrame: this.frame, getURL: () => this.url, isDestroyed: () => this.destroyed,
      on: (event: string, callback: (...args: unknown[]) => void) => this.events.set(event, callback),
      send: (channel: string, value: unknown) => sent.push({ channel, value }), setWindowOpenHandler() {} };
    constructor(public options: unknown = {}) {}
    getBounds() { return this.bounds; }
    getContentSize() { return [this.bounds.width, this.bounds.height]; }
    setContentSize(width: number, height: number) { Object.assign(this.bounds, { width, height }); }
    setPosition(x: number, y: number) { Object.assign(this.bounds, { x, y }); }
    setAlwaysOnTop() {}
    setContentProtection(value: boolean) { this.protected = value; }
    isDestroyed() { return this.destroyed; }
    isVisible() { return this.visible; }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    destroy() { this.destroyed = true; }
    async loadURL(url: string) { this.url = url; this.frame.url = url; }
    on(event: string, callback: (...args: unknown[]) => void) { this.events.set(event, callback); }
  }
  const overlay = new Window(), children: Window[] = [];
  const context = { origin, overlay, root: "/runtime", desktopDirectory: "/runtime/desktop",
    deployment: "cloud", remoteURL: origin, settings: { uiLocale: "pt-BR", protected: true },
    backgroundSmoke: false, quitting: false, abort: new AbortController(), electron: {
      ipcMain: { handle(_channel: string, handler: typeof invoke) { invoke = handler; } },
      BrowserWindow: class extends Window { constructor(options: unknown) { super(options); children.push(this); } },
      screen: { getDisplayMatching() { return { workArea: { x: 0, y: 0, width: 1920, height: 1080 } }; } },
    } } as unknown as NativeContext;
  registerAuxiliarySurface(context);
  const request = (window: Window) => ({ sender: window.webContents, senderFrame: window.frame }) as unknown as PlatformInvocation;
  const publish = { action: "publish", documentId: "11111111-1111-4111-8111-111111111111", revision: 1,
    html: '<button data-auxiliary-id="1">Allow</button>',
    kind: "modal", theme: "dark", locale: "pt-BR" };
  return { context, overlay, children, sent, publish, invoke: (window: Window, value: unknown) => invoke(request(window), value) };
}

test("a separate surface preserves the overlay size, inherits protection and forwards only current user interactions", () => {
  const value = fixture(), original = { ...value.overlay.bounds };
  value.invoke(value.overlay, value.publish);
  const child = value.children[0]!;
  expect(child.visible).toBeFalse();
  value.invoke(child, { action: "ready" });
  expect(child.visible).toBeTrue(); expect(child.protected).toBeTrue();
  expect(value.overlay.bounds).toEqual(original);
  expect(child.bounds.x).toBeGreaterThan(original.x + original.width);
  value.sent.length = 0;
  value.invoke(child, { action: "interact", documentId: value.publish.documentId, revision: 1, type: "click", target: "1" });
  expect(value.sent).toHaveLength(1);
  value.invoke(child, { action: "interact", documentId: value.publish.documentId, revision: 2, type: "click", target: "1" });
  value.invoke(child, { action: "interact", documentId: crypto.randomUUID(), revision: 1, type: "click", target: "1" });
  expect(value.sent).toHaveLength(1);
  expect(() => value.invoke(child, value.publish)).toThrow("Origem inválida");
  expect(() => value.invoke(value.overlay, { action: "ready" })).toThrow("Origem inválida");
  value.overlay.events.get("hide")!(); expect(child.visible).toBeFalse();
  value.context.abort.abort(); expect(child.destroyed).toBeTrue();
});

test("auxiliary ownership rejects navigation, subframes and stale messages after closing", () => {
  const value = fixture(); value.invoke(value.overlay, value.publish);
  const child = value.children[0]!; value.invoke(child, { action: "ready" });
  child.frame.url = "https://other.example/auxiliary.html";
  expect(() => value.invoke(child, { action: "resize", height: 300 })).toThrow("Origem inválida");
  child.frame.url = "https://orvunia.example/auxiliary.html";
  value.invoke(value.overlay, { action: "hide" });
  expect(() => value.invoke(child, { action: "interact", documentId: value.publish.documentId, revision: 1, type: "click", target: "1" })).toThrow("auxiliary_closed");
  value.context.abort.abort();
});
