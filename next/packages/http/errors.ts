import { ExpansionError } from "../expansions/domain.ts";
import { RealtimeError } from "../realtime/domain.ts";
import { CalendarError } from "../calendar/domain.ts";
import { FollowupError } from "../followups/domain.ts";
import { TranscriptionError } from "../transcription/domain.ts";
import { UsageError } from "../accounting/domain.ts";
import { OperationError } from "../operations/domain.ts";
import { ProviderError } from "../providers/domain.ts";
import { AssetError } from "../assets/domain.ts";
import { SessionError } from "../sessions/domain.ts";
import { WorkspaceError } from "../workspaces/domain.ts";
import { ZodError } from "zod";
import { ConversationError } from "../conversations/domain.ts";
import { localeFrom, message } from "../i18n/messages.ts";
import type { ErrorCode } from "../i18n/messages.ts";
import { personalError } from "./personal-errors.ts";

export class HttpError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
  ) {
    super(code);
  }
}
export function errorResponse(
  error: unknown,
  request: Request,
  requestId: string,
  mapping?: { code: ErrorCode; status: number },
) {
  const locale = localeFrom(request.headers.get("accept-language"));
  let code: ErrorCode = mapping?.code ?? "internal_error";
  let status = mapping?.status ?? 500;
  if (error instanceof ZodError) {
    code = "invalid_input";
    status = 400;
  }
  if (error instanceof HttpError) {
    code = error.code;
    status = error.status;
  }
  if (error instanceof ExpansionError) {
    code = error.code;
    status =
      code === "expansion_expired"
        ? 410
        : code === "expansion_pending"
          ? 409
          : 404;
  }
  if (error instanceof RealtimeError) {
    code = error.code;
    status = error.status;
  }
  if (error instanceof CalendarError) {
    code = error.code;
    status = error.status;
  }
  if (error instanceof FollowupError) {
    code = error.code;
    status = error.status;
  }
  if (error instanceof TranscriptionError) {
    code = error.code;
    status = error.status;
  }
  if (error instanceof UsageError) {
    code = error.code;
    status =
      code === "invalid_input"
        ? 400
        : code === "global_usage_limit"
          ? 503
          : ["usage_limit", "daily_usage_limit", "monthly_usage_limit"].includes(code)
            ? 429
            : 409;
  }
  if (error instanceof OperationError) {
    code = error.code;
    status =
      code === "unauthorized"
        ? 401
        : ["conversation_not_found", "asset_not_found"].includes(code)
          ? 404
          : 409;
  }
  if (error instanceof ProviderError) {
    code = error.code;
    status = error.status;
  }
  if (error instanceof AssetError) {
    code = error.code;
    status =
      code === "asset_removed"
        ? 410
        : ["asset_not_found", "conversation_not_found"].includes(code)
          ? 404
          : code === "invalid_image"
            ? 400
            : 409;
  }
  if (error instanceof SessionError) {
    code = error.code;
    status = ["conversation_not_found", "mode_not_found"].includes(code)
      ? 404
      : code === "invalid_input"
        ? 400
        : 409;
  }
  if (error instanceof WorkspaceError) {
    code = error.code;
    status = code === "mode_not_found" ? 404 : 409;
  }
  if (error instanceof ConversationError) {
    code = error.code;
    status =
      code === "conversation_not_found"
        ? 404
        : code === "invalid_input"
          ? 400
          : 409;
  }
  const personal = personalError(error);
  if (personal) status = personal.status;
  return Response.json(
    {
      error: {
        code: personal?.code ?? code,
        message: message(personal?.messageCode ?? code, locale) +
          (error instanceof UsageError && error.details ? ` (${error.details.resetAt} UTC)` : ""),
        requestId,
        ...(error instanceof UsageError && error.details ? { details: error.details } : {}),
        ...(error instanceof ZodError
          ? {
              fields: error.issues.map((issue) => ({
                path: issue.path.join("."),
                code: issue.code,
              })),
            }
          : {}),
      },
      ...(error instanceof ConversationError && error.current
        ? { current: error.current }
        : {}),
    },
    {
      status,
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    },
  );
}
