export function formatPromptSelection(
  value: string,
  start: number,
  end: number,
  kind: string,
  maxLength = -1,
) {
  start = Math.max(0, Math.min(value.length, start));
  end = Math.max(start, Math.min(value.length, end));
  let from = start,
    to = end,
    insert: string,
    selectedStart: number,
    selectedEnd: number;
  if (kind === "bold" || kind === "italic") {
    const marker = kind === "bold" ? "**" : "_",
      length = marker.length,
      text = value.slice(start, end);
    if (
      text.length >= length * 2 &&
      text.startsWith(marker) &&
      text.endsWith(marker)
    ) {
      insert = text.slice(length, -length);
      selectedStart = start;
      selectedEnd = start + insert.length;
    } else if (
      value.slice(Math.max(0, start - length), start) === marker &&
      value.slice(end, end + length) === marker
    ) {
      from -= length;
      to += length;
      insert = text;
      selectedStart = from;
      selectedEnd = from + text.length;
    } else {
      insert = marker + text + marker;
      selectedStart = start + length;
      selectedEnd = end + length;
    }
  } else if (kind === "bullet" || kind === "numbered") {
    from =
      start === 0 ? 0 : value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const last = end > start && value[end - 1] === "\n" ? end - 1 : end,
      next = value.indexOf("\n", last);
    to = next === -1 ? value.length : next;
    const lines = value.slice(from, to).split("\n"),
      same = kind === "bullet" ? /^(\s*)[-*+] / : /^(\s*)\d+[.)] /;
    const remove = lines.every((line) => same.test(line));
    insert = lines
      .map((line, index) => {
        if (remove) return line.replace(same, "$1");
        const clean = line.replace(/^(\s*)(?:[-*+] |\d+[.)] )/, "$1"),
          indent = clean.match(/^\s*/)?.[0] ?? "";
        return (
          indent +
          (kind === "bullet" ? "- " : `${index + 1}. `) +
          clean.slice(indent.length)
        );
      })
      .join("\n");
    selectedStart = start === end ? from + insert.length : from;
    selectedEnd = from + insert.length;
  } else return null;
  const nextValue = value.slice(0, from) + insert + value.slice(to);
  if (maxLength >= 0 && nextValue.length > maxLength) return null;
  return {
    value: nextValue,
    from,
    to,
    insert,
    start: selectedStart,
    end: selectedEnd,
  };
}
