export function transcriptionHints(language: string, tags: string, technical = false) {
  const topics = tags.replace(/[<>\r\n\u0000-\u001f]/g, " ").trim().slice(0, 600);
  const terms = topics.split(/[,;|]/).map(term => term.trim()).filter(term =>
    term.length > 0 && term.length <= 64 && /^[\p{L}\p{N} .+#/()-]+$/u.test(term)).slice(0, 8);
  const keywords = [...new Set(terms)];
  const scene = language.startsWith("pt")
    ? technical ? "Entrevista técnica de engenharia de software." : "Conversa de entrevista ou reunião."
    : language.startsWith("es")
      ? technical ? "Entrevista técnica de ingeniería de software." : "Conversación de entrevista o reunión."
      : technical ? "Technical software engineering interview." : "Interview or meeting conversation.";
  const vocabulary = keywords.length ? " Vocabulary: " + keywords.join(", ") + "." : "";
  return { prompt: scene + vocabulary, keywords };
}
