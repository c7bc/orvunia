import { documentSpanish } from "./native-spanish.ts";
const messages = {
  size: ["Use arquivos de até 5 MB.", "Use files up to 5 MB."],
  changed: [
    "Seu espaço mudou. Selecione os arquivos novamente.",
    "Your workspace changed. Select the files again.",
  ],
  unavailable: [
    "Não foi possível importar o documento.",
    "Could not import the document.",
  ],
  invalid: [
    "O documento não contém texto extraível ou não é compatível.",
    "The document has no extractable text or is unsupported.",
  ],
} as const;
export const nativeDocumentMessage = (
  code: keyof typeof messages,
  locale: string,
) =>
  locale.startsWith("es")
    ? documentSpanish[code]
    : messages[code][locale === "en" ? 1 : 0];
