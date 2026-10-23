import { escapeHtml as escape } from "../design/html.js";
import { reportMessages } from "./messages.js";
export function reportAction(id: string, locale = "pt-BR") {
  const label = escape(reportMessages(locale).title);
  return `<button class="icon-btn" type="button" data-report-answer="${escape(id)}" title="${label}" aria-label="${label}" data-i18n-skip><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 14V2.5C7 1 9 5 12 3V10C9 12 7 8 4 9" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg></button>`;
}
