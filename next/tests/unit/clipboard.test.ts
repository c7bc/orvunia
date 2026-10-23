import { expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { copyText } from "../../../client/clipboard/text.ts";
import { createCodeCopy } from "../../../client/clipboard/button.ts";
import { writeNativeClipboard } from "../../packages/desktop/native-clipboard.ts";

test("native copying accepts code verbatim without focus and rejects invalid or unavailable writes", () => {
  let copied = "";
  const clipboard = { writeText(text: string) { copied = text; } };
  const code = "const café = 1;\n  return café;\n";
  expect(writeNativeClipboard(clipboard, code)).toEqual({ copied: true });
  expect(copied).toBe(code);
  for (const value of [null, 12, "x\0y", "x".repeat(512 * 1024 + 1)])
    expect(() => writeNativeClipboard(clipboard, value)).toThrow();
  expect(() => writeNativeClipboard({}, code)).toThrow("não está disponível");
});

test("clipboard prefers the native bridge and only uses browser when the bridge is absent", async () => {
  const browser: string[] = [], native: string[] = [];
  const window = { navigator: { clipboard: { writeText: async (text: string) => { browser.push(text); } } } } as unknown as Window;
  await copyText({ native: { copy: async (text) => { native.push(text); } }, window }, "native");
  expect(native).toEqual(["native"]); expect(browser).toEqual([]);
  await copyText({ window }, "browser"); expect(browser).toEqual(["browser"]);
  await expect(copyText({ native: { copy: async () => { throw Error("Rejected"); } }, window }, "failed")).rejects.toThrow();
  expect(browser).toEqual(["browser"]);
});

function fixture(copy: (text: string) => Promise<unknown>) {
  const document = parseHTML('<html><body><div class="markdown"><pre><code>const x = 1;\n  return x;</code></pre></div></body></html>').document as unknown as Document;
  const timers: (() => void)[] = [], notices: string[] = [];
  const controller = createCodeCopy({ document, copy, translate: text => text,
    toast: text => notices.push(text), schedule: callback => timers.push(callback) });
  controller.decorate();
  return { document, controller, timers, notices, button: () => document.querySelector<HTMLButtonElement>(".copy-code")! };
}

test("copy feedback follows completion, excludes toolbar text and restored DOM buttons get working handlers", async () => {
  let finish!: () => void;
  const copied: string[] = [];
  const view = fixture(text => { copied.push(text); return new Promise<void>(resolve => { finish = resolve; }); });
  const button = view.button(); button.click();
  expect(button.disabled).toBe(true); expect(button.textContent).toBe("Copiando…");
  expect(copied).toEqual(["const x = 1;\n  return x;"]);
  view.controller.decorate(); expect(view.document.querySelectorAll(".copy-code")).toHaveLength(1);
  finish(); await Bun.sleep(0);
  expect(button.textContent).toBe("Copiado."); expect(button.dataset.copyState).toBe("copied");
  expect(button.disabled).toBe(false); expect(view.notices).toEqual(["Código copiado."]);
  view.timers[0]!(); expect(button.textContent).toBe("Copiar código");
  const host = view.document.querySelector(".markdown")!;
  host.innerHTML = host.innerHTML;
  view.controller.decorate(); view.button().click();
  expect(copied).toHaveLength(2); finish(); await Bun.sleep(0);
  expect(view.button().dataset.copyState).toBe("copied");
});

test("failed copying never reports success and a retry can succeed", async () => {
  let attempts = 0;
  const view = fixture(async () => { if (++attempts === 1) throw Error("Clipboard denied"); });
  view.button().click(); await Bun.sleep(0);
  expect(view.button().dataset.copyState).toBe("error");
  expect(view.button().textContent).toBe("Tentar novamente");
  expect(view.notices).toEqual(["Não foi possível copiar. Tente novamente."]);
  view.button().click(); await Bun.sleep(0);
  expect(view.button().dataset.copyState).toBe("copied");
  view.timers[0]!(); expect(view.button().dataset.copyState).toBe("copied");
});

test("answer icon feedback survives restored nodes and duplicate clicks copy only once", async () => {
  const document = parseHTML('<html><body><button data-action="copy:answer"><svg></svg></button></body></html>').document as unknown as Document;
  const callbacks: (() => void)[] = [], writes: string[] = [];
  let finish!: () => void;
  const controller = createCodeCopy({ document, copy: text => { writes.push(text); return new Promise<void>(resolve => { finish = resolve; }); },
    translate: text => text, toast() {}, schedule: callback => callbacks.push(callback), response: id => id === "answer" ? "Full answer\ncode" : undefined });
  controller.decorate();
  document.querySelector<HTMLButtonElement>("button")!.click();
  document.querySelector<HTMLButtonElement>("button")!.click();
  expect(writes).toEqual(["Full answer\ncode"]);
  document.body.innerHTML = document.body.innerHTML; controller.decorate();
  const restored = document.querySelector<HTMLButtonElement>("button")!;
  expect(restored.disabled).toBe(true);
  expect(restored.title).toBe("Copiando…");
  finish(); await Bun.sleep(0);
  expect(restored.dataset.copyState).toBe("copied");
  expect(restored.title).toBe("Copiado.");
  expect(restored.querySelector("svg path")?.getAttribute("d")).toBe("m4 12 5 5L20 6");
  callbacks[0]!(); expect(restored.getAttribute("aria-label")).toBe("Copiar resposta");
  expect(restored.dataset.copyState).toBeUndefined();
});

test("a streaming code change never inherits a previous copy success or loses its newest handler", async () => {
  const resolutions: (() => void)[] = [], writes: string[] = [];
  const view = fixture(text => { writes.push(text); return new Promise<void>(resolve => resolutions.push(resolve)); });
  view.button().click();
  view.document.querySelector("code")!.textContent = "NEW CODE";
  view.controller.decorate();
  expect(view.button().disabled).toBe(false);
  view.button().click();
  resolutions[0]!(); await Bun.sleep(0);
  expect(view.button().dataset.copyState).toBe("pending");
  expect(writes).toEqual(["const x = 1;\n  return x;", "NEW CODE"]);
  resolutions[1]!(); await Bun.sleep(0);
  expect(view.button().dataset.copyState).toBe("copied");
});
