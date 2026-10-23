import { CapabilityError } from "../capabilities/domain.ts";
import { ConnectionError } from "../connections/domain.ts";
import { LocalModelError } from "../local-models/domain.ts";
import { hasMessage, type ErrorCode } from "../i18n/messages.ts";

export function personalError(error: unknown): { code: string; status: number; messageCode: ErrorCode } | null {
  if (!(error instanceof CapabilityError || error instanceof ConnectionError || error instanceof LocalModelError)) return null;
  const fallback: ErrorCode = error instanceof ConnectionError ?
    error.status === 503 ? "provider_settings_unreadable" : "invalid_input" :
    /busy|in_use|bound|conflict/.test(error.code) ? "local_model_busy" :
      /invalid|unsafe|mismatch|exceeded|unsupported|too_large/.test(error.code) ? "local_model_invalid" : "local_model_unavailable";
  return { code: error.code, status: error.status, messageCode: hasMessage(error.code) ? error.code : fallback };
}
