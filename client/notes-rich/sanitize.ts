type Purifier = {
  sanitize(
    html: string,
    options: { FORBID_TAGS: string[]; FORBID_ATTR: string[] },
  ): string;
};
function purifier(value: unknown): value is Purifier {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    "sanitize" in value &&
    typeof value.sanitize === "function"
  );
}
export function browserSanitizer(document: Document) {
  return (html: string) => {
    const window = document.defaultView;
    const candidate: unknown =
      window && "DOMPurify" in window ? window.DOMPurify : null;
    return purifier(candidate)
      ? candidate.sanitize(html, {
          FORBID_TAGS: ["img", "iframe", "video", "audio", "style", "script"],
          FORBID_ATTR: ["style"],
        }) || ""
      : "";
  };
}
