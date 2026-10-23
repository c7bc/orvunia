import type { OnboardingView } from "./contracts.js";
import { escapeHtml as escape } from "../design/escape.js";
import { t } from "@cadence/i18n";
export const messages = (context: OnboardingView) =>
  `${context.error ? `<p data-i18n-skip class="welcome-error" role="alert">${escape(t(context.error))}</p>` : ""}${context.notice ? `<p class="welcome-notice" role="status">${escape(context.notice)}</p>` : ""}`;
export const submit = (context: OnboardingView, label: string) =>
  `<button class="welcome-primary" type="submit" ${context.busy ? "disabled" : ""}>${context.busy ? "Aguarde…" : label}</button>`;
