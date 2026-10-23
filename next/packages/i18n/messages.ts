import { english } from "./english.ts";
import { portuguese } from "./portuguese.ts";
import { spanish } from "./spanish.ts";
const messages = { en: english, "pt-BR": portuguese, es: spanish };
export type ErrorCode = keyof typeof messages.en;
export const hasMessage = (code: unknown): code is ErrorCode =>
  typeof code === "string" && Object.hasOwn(messages.en, code);
export type Locale = keyof typeof messages;
export function localeFrom(header: string | null): Locale {
  const choices = (header ?? "")
    .split(",")
    .map((part, order) => {
      const [language, ...parameters] = part.trim().split(";");
      const quality = parameters.find((value) => value.trim().startsWith("q="));
      return {
        language: language?.toLowerCase(),
        quality: quality ? Number(quality.trim().slice(2)) : 1,
        order,
      };
    })
    .filter(
      (choice) =>
        Number.isFinite(choice.quality) &&
        choice.quality > 0 &&
        choice.quality <= 1,
    )
    .sort(
      (first, second) =>
        second.quality - first.quality || first.order - second.order,
    );
  for (const choice of choices) {
    if (choice.language === "es" || choice.language?.startsWith("es-"))
      return "es";
    if (choice.language === "pt" || choice.language?.startsWith("pt-"))
      return "pt-BR";
    if (choice.language === "en" || choice.language?.startsWith("en-"))
      return "en";
  }
  return "en";
}
export const message = (code: ErrorCode, locale: Locale) =>
  messages[locale][code];
