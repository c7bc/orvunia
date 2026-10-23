export type NoteSection = { title: string; instructions: string };
export function sectionsFromTemplate(text: string): NoteSection[] {
  if (!text.trim()) return [];
  if (!text.startsWith("## ")) return [{ title: "Notas", instructions: text }];
  return text.split(/\n(?=## )/).map((part) => {
    const [title = "", ...body] = part.split("\n");
    return {
      title: title.slice(3).trim(),
      instructions: body.join("\n").trim(),
    };
  });
}
export function serializeNoteSections(sections: NoteSection[]) {
  const text = sections
    .map(
      (section) =>
        `## ${section.title.trim() || "Nova seção"}\n${section.instructions.trim()}`,
    )
    .join("\n\n");
  if (text.length > 38000)
    throw Error("Reduza as instruções do modelo de notas antes de salvar.");
  return text;
}
