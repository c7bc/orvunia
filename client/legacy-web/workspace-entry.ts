import { createCompatibilityApplication } from "./application.js";
import type { CompatibilityGlobals } from "./platform-types.js";
const browser: CompatibilityGlobals = window;
const application = createCompatibilityApplication({
  window,
  document,
  api: {
    request: (path, options) => browser.CadenceApi.request(path, options),
    answer: (id, input, signal, delta) =>
      browser.CadenceApi.answer(id, input, signal, delta),
  },
  live() {
    if (!browser.Live) throw Error("O servidor ainda não está conectado.");
    return browser.Live;
  },
  markdown: (value) => browser.marked.parse(value),
  sanitize: (value, options) => browser.DOMPurify.sanitize(value, options),
  randomUUID: () => window.crypto.randomUUID(),
  abortController: () => new AbortController(),
});
browser.CadenceCompatibility = application;
application.mount();
