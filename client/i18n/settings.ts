import type {
  Catalog,
  Parameters,
  LocaleOptions,
  LocalePlatform,
} from "./domain";
import { normalizeLocale } from "./domain";
import { dynamicEnglish } from "./patterns";
import { dynamicSpanish } from "./spanish-patterns";
export function createLocaleSettings(platform: LocalePlatform, messages: Catalog, spanish: Catalog) {
  let locale = normalizeLocale(platform.read() ?? "pt-BR");
  const portuguese = new Map(
    Object.entries(messages)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      )
      .map(([key, value]) => [value, key]),
  );
  const currentLocale = () => locale;
  const spanishSources = new Map(
    Object.entries(spanish).map(([source, translated]) => [translated, source]),
  );
  const setLocale = (
    value: unknown,
    { persist = true, notify = true }: LocaleOptions = {},
  ) => {
    const next = normalizeLocale(value),
      changed = locale !== next;
    locale = next;
    if (persist) platform.write(locale);
    platform.documentLocale(locale);
    if (changed && notify) platform.notify(locale);
    return locale;
  };
  function translate(value: unknown, parameters: Parameters = {}): string {
    const source = String(value ?? "");
    const canonical =
      portuguese.get(source) || spanishSources.get(source) || source;
    let translated =
      locale === "en"
        ? messages[canonical] || source
        : locale === "es"
          ? (spanish as Catalog)[canonical] || source
          : canonical;
    if (typeof translated === "function") translated = translated(parameters);
    const rendered = String(translated).replace(
      /\{(\w+)\}/g,
      (whole: string, name: string) =>
        Object.hasOwn(parameters, name) ? String(parameters[name]) : whole,
    );
    if (rendered !== source) return rendered;
    if (locale === "en") return dynamicEnglish(source, translate);
    if (locale === "es") return dynamicSpanish(source, translate);
    return rendered;
  }
  const number = (value: number | bigint, options?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(locale, options).format(value);
  platform.documentLocale(locale);
  return {
    currentLocale,
    setLocale,
    t: translate,
    number,
    plural: (
      count: number,
      forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
    ) =>
      translate(
        forms[new Intl.PluralRules(locale).select(count)] || forms.other,
        { count: number(count) },
      ),
  };
}
export type LocaleSettings = ReturnType<typeof createLocaleSettings>;
