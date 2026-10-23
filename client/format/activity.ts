import { currentLocale, t } from "@cadence/i18n";
type DateValue = string | number | Date | undefined;
type ActivityOptions = { locale?: string; now?: Date };
const sameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();
export function formatAccountActivity(
  value: DateValue,
  { locale = currentLocale(), now = new Date() }: ActivityOptions = {},
) {
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value ?? NaN);
  if (!Number.isFinite(+date)) return t("Atividade indisponível");
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  const previous = new Date(now);
  previous.setDate(previous.getDate() - 1);
  if (sameDay(date, now))
    return locale.startsWith("es")
      ? `Hoy a las ${time}`
      : locale === "en"
        ? `Today at ${time}`
        : `Hoje às ${time}`;
  if (sameDay(date, previous))
    return locale.startsWith("es")
      ? `Ayer a las ${time}`
      : locale === "en"
        ? `Yesterday at ${time}`
        : `Ontem às ${time}`;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
export function accountDeviceDetails(
  session: {
    userAgent?: string | null;
    updatedAt?: DateValue;
    createdAt?: DateValue;
  },
  options: ActivityOptions = {},
) {
  const agent = String(session.userAgent || "");
  const os = /Windows/i.test(agent)
    ? "Windows"
    : /Android/i.test(agent)
      ? "Android"
      : /iPhone|iPad/i.test(agent)
        ? "iOS"
        : /Mac/i.test(agent)
          ? "macOS"
          : /Linux/i.test(agent)
            ? "Linux"
            : t("Dispositivo");
  const candidates: [string, RegExp][] = [
    ["Electron", /Electron\/([\d.]+)/i],
    ["Firefox", /Firefox\/([\d.]+)/i],
    ["Edge", /Edg(?:A|iOS)?\/([\d.]+)/i],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/i],
    ["Safari", /Version\/([\d.]+).*Safari/i],
  ];
  const match = candidates
    .map(([name, pattern]) => ({ name, match: agent.match(pattern) }))
    .find((item) => item.match);
  return {
    os,
    browser: match ? `${match.name} ${match.match![1]}` : t("Navegador"),
    date: formatAccountActivity(
      session.updatedAt || session.createdAt,
      options,
    ),
    icon: /iPad|Tablet/i.test(agent)
      ? "tablet"
      : /Android|iPhone/i.test(agent)
        ? "phone"
        : "monitor",
  };
}
