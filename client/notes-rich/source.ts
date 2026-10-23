// Keep unsupported Markdown in its original source instead of normalizing it.
export function requiresSource(text: string) {
  return /(^|\n)\s*(?:\|.+\||\[\^[^\]]+\]:|(?:[-*+]\s+)\[[ xX]\])|!\[[^\]]*\]\(|<\/?[a-zA-Z][^>]*>/.test(
    text,
  );
}
