export type Locale = "pt-BR" | "en" | "es";
export type Parameters = Record<string, unknown>;
export type Catalog = Record<
  string,
  string | ((parameters: Parameters) => string)
>;
export type LocaleOptions = { persist?: boolean; notify?: boolean };
export type LocalePlatform = {
  read(): string | null;
  write(locale: Locale): void;
  documentLocale(locale: Locale): void;
  notify(locale: Locale): void;
  storage(callback: (locale: string) => void): () => void;
};
export const normalizeLocale = (value: unknown): Locale => {
  const language = String(value).toLowerCase().split(/[-_]/)[0];
  return language === "en" || language === "es" ? language : "pt-BR";
};
