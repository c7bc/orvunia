import { ProviderError } from "./domain.ts";

export function providerRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ProviderError("provider_unavailable");
  return value as Record<string, unknown>;
}
export function tokenCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}
export function tokenUsage(input: unknown, output: unknown) {
  const inputTokens = tokenCount(input),
    outputTokens = tokenCount(output);
  return inputTokens !== undefined && outputTokens !== undefined
    ? { inputTokens, outputTokens }
    : undefined;
}
export function providerFailure(error: unknown) {
  if (error instanceof ProviderError) return error;
  const status =
    error && typeof error === "object" && "status" in error
      ? Number(error.status)
      : 0;
  return new ProviderError(
    status === 401 || status === 403
      ? "provider_auth"
      : status === 429
        ? "provider_limit"
        : [400, 404].includes(status)
          ? "provider_request"
          : "provider_unavailable",
    status === 429 ? 429 : 502,
  );
}
