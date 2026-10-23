import { flowLanguages } from "./language.js";
export const compatibilityResponseLanguages = flowLanguages.map(
  ([key, label]) => [key === "pt" ? "pt-BR" : key, label] as const,
);
export const compatibilityTranscriptionLanguages = [
  ["auto", "Detectar automaticamente"] as const,
  ...flowLanguages,
];
export const compatibilityCodeLanguages = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Java",
  "C++",
  "C#",
  "Go",
  "Rust",
  "Kotlin",
  "Swift",
  "SQL",
  "Ruby",
];
