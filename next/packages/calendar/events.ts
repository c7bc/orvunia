import { z } from "zod";
import type { CalendarEvent } from "./domain.ts";
const date = z.object({
  dateTime: z.string().max(100).optional(),
  date: z.string().max(20).optional(),
  timeZone: z.string().max(100).optional(),
});
export const googleEvents = z.object({
  nextPageToken: z.string().max(2000).optional(),
  timeZone: z.string().max(100).optional(),
  items: z
    .array(
      z.object({
        id: z.string().max(1000),
        summary: z.string().max(10000).optional(),
        status: z.string().max(30).optional(),
        start: date.optional(),
        end: date.optional(),
        location: z.string().max(10000).optional(),
        htmlLink: z.string().max(10000).optional(),
        hangoutLink: z.string().max(10000).optional(),
        conferenceData: z
          .object({
            entryPoints: z
              .array(
                z.object({
                  entryPointType: z.string().max(30),
                  uri: z.string().max(10000).optional(),
                }),
              )
              .max(100)
              .optional(),
          })
          .optional(),
      }),
    )
    .max(1000)
    .default([]),
});
function safeUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export function projectEvents(
  data: z.infer<typeof googleEvents>,
): CalendarEvent[] {
  return data.items.flatMap((item) => {
    if (
      item.status === "cancelled" ||
      (!item.start?.dateTime && !item.start?.date)
    )
      return [];
    return [
      {
        id: item.id,
        title: (item.summary ?? "").slice(0, 500),
        start: item.start.dateTime ?? item.start.date!,
        end: item.end?.dateTime ?? item.end?.date ?? "",
        allDay: Boolean(item.start.date),
        timeZone: item.start.timeZone ?? data.timeZone ?? "",
        location: (item.location ?? "").slice(0, 500),
        url: safeUrl(item.htmlLink),
        joinUrl:
          safeUrl(item.hangoutLink) ||
          safeUrl(
            item.conferenceData?.entryPoints?.find(
              (entry) => entry.entryPointType === "video",
            )?.uri,
          ),
      },
    ];
  });
}
