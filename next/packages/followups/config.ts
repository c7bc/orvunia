import { z } from "zod";
import type { SmtpSettings } from "./smtp.ts";
export function followupConfig(
  environment: Record<string, string | undefined>,
  cloudSender = "",
) {
  const enabled =
    z
      .enum(["true", "false"])
      .parse(environment.CADENCE_FOLLOWUP_ENABLED || "false") === "true";
  const dailyLimit = z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .parse(environment.CADENCE_FOLLOWUP_DAILY_LIMIT || 20);
  const explicit = Boolean(environment.CADENCE_FOLLOWUP_SMTP_HOST),
    prefix = explicit ? "CADENCE_FOLLOWUP_SMTP_" : "CADENCE_SMTP_";
  const host = environment[prefix + "HOST"] || "";
  const sender =
    (host
      ? environment.CADENCE_FOLLOWUP_FROM ||
        environment[prefix + "FROM"] ||
        environment.CADENCE_SMTP_FROM
      : cloudSender) || "";
  let smtp: SmtpSettings | null = null;
  if (host) {
    z.string()
      .min(1)
      .max(253)
      .regex(/^[a-zA-Z0-9.:[\]-]+$/)
      .parse(host);
    z.email().max(254).parse(sender);
    const port = z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .parse(environment[prefix + "PORT"] || 587);
    const secure =
      z
        .enum(["true", "false"])
        .parse(environment[prefix + "SECURE"] || "false") === "true";
    const insecureLoopback =
      ["127.0.0.1", "localhost", "::1"].includes(host) &&
      environment.CADENCE_FOLLOWUP_ALLOW_INSECURE_LOOPBACK === "true";
    smtp = {
      host,
      port,
      secure,
      from: sender,
      user: environment[prefix + "USER"] || "",
      password: environment[prefix + "PASSWORD"] || "",
      insecureLoopback,
    };
  }
  return {
    enabled,
    dailyLimit,
    sender,
    smtp,
    configured: Boolean(smtp || cloudSender),
  };
}
