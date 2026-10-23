export function speechGroup(entries: Iterable<{ id: string; text: string }>) {
  const ids: string[] = [], lines: string[] = [];
  let length = 0;
  for (const entry of entries) {
    const text = entry.text.trim();
    if (!text) continue;
    if (ids.length >= 80 || (ids.length && length + text.length + 1 > 6000)) break;
    const excerpt = text.slice(0, 6000);
    ids.push(entry.id); lines.push(excerpt); length += excerpt.length + 1;
  }
  return { ids, question: lines.join("\n") };
}
