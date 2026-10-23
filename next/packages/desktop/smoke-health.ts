import { z } from "zod";

const healthContract = z.object({ keyConfigured: z.boolean() });
const diagnosticContract = z.object({
  error: z.object({
    code: z.enum([
      "unauthorized",
      "forbidden",
      "rate_limited",
      "unavailable",
      "internal_error",
      "invalid_input",
    ]),
  }),
});

export async function nativeSmokeHealth(options: {
  origin: string;
  token: string | null;
  signal: AbortSignal;
  fetch(url: string, options: RequestInit): Promise<Response>;
  timeout?: number;
}) {
  const signal = AbortSignal.any([
    options.signal,
    AbortSignal.timeout(options.timeout ?? 7000),
  ]);
  let response: Response;
  try {
    response = await options.fetch(`${options.origin}/api/health`, {
      headers: options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {},
      signal,
      redirect: "error",
    });
  } catch {
    throw Error(
      signal.aborted
        ? "Native smoke health request cancelled or timed out"
        : "Native smoke health transport failed",
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw Error(`Native smoke health HTTP ${response.status}: invalid JSON`);
  }
  if (response.status !== 200) {
    const diagnostic = diagnosticContract.safeParse(body);
    throw Error(
      `Native smoke health HTTP ${response.status}: ${diagnostic.success ? diagnostic.data.error.code : "unknown_error"}`,
    );
  }
  const parsed = healthContract.safeParse(body);
  if (!parsed.success)
    throw Error("Native smoke health HTTP 200: invalid contract");
  return parsed.data;
}
