import { catalog } from "./personal-catalog";
import { createLocaleSettings } from "./settings";
import spanish from "./personal-spanish";
import { browserLocale, browserDocument } from "./browser";
import { domTranslations } from "./dom";
export const supportedLocales = ["pt-BR", "en", "es"] as const;
const platform = browserLocale();
const settings = createLocaleSettings(platform, catalog, spanish);
const dom = domTranslations(settings, {
  document: browserDocument,
  observer: (callback) => new MutationObserver(callback),
});
export const { currentLocale, setLocale, t, number, plural } = settings;
export const { translateUI, observeUI } = dom;
export const disposeLocale = platform.storage((value) => {
  settings.setLocale(value, { persist: false });
});
