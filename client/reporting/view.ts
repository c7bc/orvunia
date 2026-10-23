import { escapeHtml as escape } from "../design/html.js";
import { reportMessages } from "./messages.js";
import { reportRecipient } from "./draft.js";
export function reportView(locale: string) {
  const t = reportMessages(locale);
  return `<div data-report-form data-i18n-skip><p>${escape(t.recipient)}: <strong>${reportRecipient}</strong></p>
    <p class="subtitle">${escape(t.privacy)}</p><div class="fields">
    <label class="field full">${escape(t.reason)}<textarea data-report-reason rows="2" maxlength="500" required></textarea></label>
    <label class="field full report-choice"><input data-report-include type="checkbox"><span>${escape(t.include)}</span></label>
    <label class="field full">${escape(t.context)}<textarea data-report-context rows="3" maxlength="2500"></textarea></label>
    <small>${escape(t.excerpt)}</small>
    <label class="field full">${escape(t.preview)}<textarea data-report-preview rows="5" maxlength="4000"></textarea></label></div>
    <p>${escape(t.notice)}</p><p data-report-status role="status"></p>
    <div class="form-footer"><button class="btn" type="button" data-report-cancel>${escape(t.cancel)}</button>
    <button class="btn" type="button" data-report-copy>${escape(t.copy)}</button>
    <button class="btn primary" type="button" data-report-open>${escape(t.open)}</button></div></div>`;
}
