import { globalEnglish } from "./global-en.ts";
import { globalPortuguese } from "./global-pt.ts";
import { globalSpanish } from "./global-es.ts";

export type GlobalPromptLocale = "en" | "pt-BR" | "es";
const templates: Record<GlobalPromptLocale, string> = {
  en: globalEnglish, "pt-BR": globalPortuguese, es: globalSpanish,
};
export function globalSystemPrompt(locale: GlobalPromptLocale): string {
  return templates[locale];
}
export function recognizedGlobalSystemPromptLocale(text: string): GlobalPromptLocale | null {
  for (const locale of ["en", "pt-BR", "es"] as const) if (text === templates[locale]) return locale;
  return null;
}
