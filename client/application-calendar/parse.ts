import type { CommandAgenda } from "../commands/model.js";
export function parseCalendar(
  text: string,
  options: {
    existing: CommandAgenda[];
    mode: string;
    clock(): number;
    identifier(): string;
  },
) {
  const entries: CommandAgenda[] = [];
  const known = new Set(options.existing.map((entry) => entry.calendarUid));
  for (const event of text
    .replace(/\r?\n[ \t]/g, "")
    .split("BEGIN:VEVENT")
    .slice(1)) {
    const title = event
      .match(/(?:^|\n)SUMMARY:(.*)/)?.[1]
      ?.replace(/\\n/gi, " ")
      .replace(/\\([,;\\])/g, "$1")
      .trim();
    const raw = event.match(
      /(?:^|\n)DTSTART(?:;[^:]*)?:(\d{8}(?:T\d{6}Z?)?)/,
    )?.[1];
    if (!raw || !title) continue;
    const parts = raw.match(
      /^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d))?(Z)?$/,
    );
    if (!parts) continue;
    const [, year, month, day, hour = "09", minute = "00", second = "00", utc] =
      parts;
    const when = utc
      ? new Date(
          Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
            +hour,
            +minute,
            +second,
          ),
        )
      : new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          +hour,
          +minute,
          +second,
        );
    if (!Number.isFinite(+when) || +when < options.clock()) continue;
    const uid =
      event.match(/(?:^|\n)UID:(.*)/)?.[1]?.trim() ||
      title + when.toISOString();
    if (known.has(uid)) continue;
    known.add(uid);
    entries.push({
      id: options.identifier(),
      title: title.slice(0, 200),
      date: when.toISOString(),
      mode: options.mode,
      calendarUid: uid,
    });
    if (entries.length >= 100) break;
  }
  return entries;
}
