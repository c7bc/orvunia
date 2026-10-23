import type { ApplicationEdition } from "../application-services/edition.js";
import { createDesktopApplication } from "./compose.js";
import type { RawNative } from "./native.js";
import type { CompatibilityGlobals } from "../legacy-web/platform-types.js";
import {
  currentLocale,
  setLocale,
  t,
  translateUI,
  observeUI,
} from "@cadence/i18n";
import { icon } from "@cadence/icons";
import { copyText } from "../clipboard/text.js";
type BrowserWindow = Window & Pick<CompatibilityGlobals, "marked" | "DOMPurify"> & {
  cadence?: RawNative;
  hljs?: { highlightElement(element: HTMLElement): void };
};
export function startBrowserApplication(edition?: ApplicationEdition) {
const browser = window as BrowserWindow;
const application = createDesktopApplication(
  {
    document,
    window,
    identifier: () => crypto.randomUUID(),
    escapeSelector: CSS.escape,
    url: URL,
    blob: Blob,
    clock: Date.now,
    broadcast: new BroadcastChannel("cadence-studio"),
    fetch: (...args) => fetch(...args),
    locale: currentLocale,
    setLocale,
    translate: t,
    translateUI,
    observeUI: (root) => (root ? observeUI(root) : undefined),
    icon,
    markdown: {
      parse: (text) => browser.marked.parse(text),
      sanitize: (text, options) => browser.DOMPurify.sanitize(text, options),
      highlight: (element) => browser.hljs?.highlightElement(element),
      copy: (text) => copyText({ native: browser.cadence || null, window: browser }, text),
    },
  },
  browser.cadence || null,
  edition,
);
void application.start();

return application;
}
