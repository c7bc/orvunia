import spanish from "../i18n/personal-spanish";
export const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }) as Record<string, string>
      )[c] ?? c,
  );
export const label = (locale: string | undefined, pt: string, en: string) =>
  locale?.startsWith("es")
    ? spanish[pt as keyof typeof spanish] || pt
    : locale === "en"
      ? en
      : pt;
