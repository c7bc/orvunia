import { createLegacyLive } from "./index.js";
import type { CompatibilityGlobals } from "./platform-types.js";
const browser: CompatibilityGlobals = window;
if (!browser.CadenceCompatibility)
  throw Error("Abra o espaço de entrevistas antes de conectar o servidor.");
const controller = createLegacyLive(
  browser.CadenceCompatibility.connect(new browser.CadenceAudio()),
);
browser.Live = controller;
void controller.boot();
