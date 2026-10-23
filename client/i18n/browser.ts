import type { LocalePlatform } from "./domain";
export const browserDocument = () =>
  typeof document === "undefined" ? undefined : document;
export function browserLocale(): LocalePlatform {
  return {
    read() {
      try {
        return localStorage.getItem("cadence-ui-locale");
      } catch {
        return null;
      }
    },
    write(locale) {
      try {
        localStorage.setItem("cadence-ui-locale", locale);
      } catch {}
    },
    documentLocale(locale) {
      const document = browserDocument();
      if (document) document.documentElement.lang = locale;
    },
    notify(locale) {
      if (typeof window !== "undefined")
        window.dispatchEvent(
          new CustomEvent("cadence:locale", { detail: { locale } }),
        );
    },
    storage(callback) {
      if (typeof window === "undefined") return () => {};
      const listener = (event: StorageEvent) => {
        if (event.key === "cadence-ui-locale" && event.newValue)
          callback(event.newValue);
      };
      window.addEventListener("storage", listener);
      return () => window.removeEventListener("storage", listener);
    },
  };
}
