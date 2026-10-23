import { supportReportURL } from "../support/report.ts";
export async function openSupportReportDraft(input: unknown, open: (url: string) => Promise<unknown>) {
  const url = supportReportURL(input);
  try { await open(url); return { opened: true }; }
  catch { return { opened: false }; }
}
