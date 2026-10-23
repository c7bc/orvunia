import { expect, test } from "bun:test";
import { supportReportURL, reportCopy, validReportBody, reportExcerpt } from "../../packages/support/report.ts";
import { openSupportReportDraft } from "../../packages/desktop/support-report.ts";
import { permittedExternalURL } from "../../packages/desktop/external.ts";
import { registerSupportReport } from "../../packages/desktop/support-native.ts";
import type { NativeContext } from "../../packages/desktop/application-types.ts";
import type { NativeControllers } from "../../packages/desktop/application-controllers.ts";

test("support draft has fixed address/subject and body cannot inject mail headers", () => {
  const body = "Motivo: conteúdo inadequado\n\nTexto escolhido: café & bcc=other@example.test";
  const url = new URL(supportReportURL({ body }));
  expect(url.protocol).toBe("mailto:"); expect(url.pathname).toBe("support@orvunia.com");
  expect([...url.searchParams.keys()]).toEqual(["subject", "body"]);
  expect(url.searchParams.get("subject")).toBe("Orvunia - AI content report");
  expect(url.searchParams.get("body")).toBe(body);
  expect(reportCopy(body)).toContain(body);
  expect(() => permittedExternalURL(url.href, "http://127.0.0.1:9915", null)).toThrow();
});

test("draft rejects unknown fields, controls, CRLF, oversized and encoded overflow", () => {
  for (const input of [null, [], "text", {}, { body: 2 }, { body: " " },
    { body: "fine", to: "other@example.test" }, { body: "fine", subject: "override" },
    { body: "hello\r\nBcc:other@example.test" }, { body: "a\0b" }, { body: "a\tb" },
    { body: "a\u202eb" }, { body: "a".repeat(4001) }, { body: "😀".repeat(1900) }])
    expect(() => supportReportURL(input)).toThrow();
  expect(validReportBody("a".repeat(3900))).toBe(true);
  expect(validReportBody("reason\n\ud83d")).toBe(false);
  expect(validReportBody("reason\n\udc00")).toBe(false);
  const excerpt = reportExcerpt("a".repeat(2499) + "😀");
  expect(excerpt).toBe("a".repeat(2499));
  expect(validReportBody(excerpt)).toBe(true);
  expect(reportExcerpt("a".repeat(2498) + "😀")).toBe("a".repeat(2498) + "😀");
});

test("opening invokes only the selected mail draft and OS failure yields explicit fallback", async () => {
  const calls: string[] = [];
  expect(await openSupportReportDraft({ body: "User selected reason" }, async url => { calls.push(url); }))
    .toEqual({ opened: true });
  expect(calls).toHaveLength(1);
  expect(await openSupportReportDraft({ body: "Another reason" }, async () => { throw Error("No handler"); }))
    .toEqual({ opened: false });
  await expect(openSupportReportDraft({ body: "x", recipient: "evil" }, async () => { calls.push("invalid"); })).rejects.toThrow();
  expect(calls).toHaveLength(1);
});

test("dedicated native IPC checks trusted live sender and interactive lifecycle before opening", async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>(), opened: string[] = [];
  const frame = { url: "http://127.0.0.1:9915/desktop.html" };
  const owned = { mainFrame: frame, getURL: () => frame.url, isDestroyed: () => false };
  let closing = false;
  registerSupportReport({ origin: "http://127.0.0.1:9915", electron: {
    ipcMain: { handle: (name: string, handler: (...args: unknown[]) => unknown) => handlers.set(name, handler) },
    shell: { openExternal: async (url: string) => { opened.push(url); } },
  } } as unknown as NativeContext, { contents: () => [owned],
    interactive() { if (closing) throw Error("Closing"); } } as unknown as NativeControllers);
  const invoke = handlers.get("cadence:openSupportReport")!;
  expect(handlers.size).toBe(1);
  expect(() => invoke({ sender: { ...owned }, senderFrame: frame }, { body: "reason" })).toThrow();
  expect(opened).toHaveLength(0);
  expect(await invoke({ sender: owned, senderFrame: frame }, { body: "reason" })).toEqual({ opened: true });
  closing = true;
  expect(() => invoke({ sender: owned, senderFrame: frame }, { body: "reason" })).toThrow("Closing");
  expect(opened).toHaveLength(1);
});
