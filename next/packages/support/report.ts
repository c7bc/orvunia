export const reportRecipient = "support@orvunia.com";
export const reportSubject = "Orvunia - AI content report";
export function validReportBody(body: string) {
  if (!body.trim() || body.length > 4000 ||
    /[\x00-\x09\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/.test(body)) return false;
  try {
    return `mailto:${reportRecipient}?subject=${encodeURIComponent(reportSubject)}&body=${encodeURIComponent(body)}`.length <= 7800;
  } catch { return false; }
}
export function reportExcerpt(text: string, maximum = 2500) {
  const excerpt = text.slice(0, maximum);
  return /[\uD800-\uDBFF]$/.test(excerpt) ? excerpt.slice(0, -1) : excerpt;
}
export function supportReportURL(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
    Object.keys(input).length !== 1 || !("body" in input) ||
    typeof input.body !== "string" || !validReportBody(input.body))
    throw Error("Invalid support report draft");
  return `mailto:${reportRecipient}?subject=${encodeURIComponent(reportSubject)}&body=${encodeURIComponent(input.body)}`;
}
export function reportCopy(body: string) {
  if (!validReportBody(body)) throw Error("Invalid report draft");
  return `To: ${reportRecipient}\nSubject: ${reportSubject}\n\n${body}`;
}
