import nodemailer from "nodemailer";
import { DeliveryError } from "../notifications/domain.ts";
import type { EmailTransport } from "../notifications/domain.ts";
export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  from: string;
  user: string;
  password: string;
  insecureLoopback: boolean;
};
export function smtpTransport(settings: SmtpSettings): EmailTransport {
  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    requireTLS: !settings.secure && !settings.insecureLoopback,
    ignoreTLS: settings.insecureLoopback,
    ...(settings.user
      ? { auth: { user: settings.user, pass: settings.password } }
      : {}),
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    tls: { minVersion: "TLSv1.2" },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return {
    async send(id, email) {
      const messageId = `<${id}@${settings.from.split("@")[1]}>`;
      try {
        const result = await transport.sendMail({
          from: { name: "Orvunia", address: settings.from },
          to: { name: "", address: email.to },
          subject: email.subject,
          text: email.text,
          html: email.html,
          messageId,
          disableFileAccess: true,
          disableUrlAccess: true,
        });
        if (
          !result.accepted.some(
            (value) => value.toLowerCase() === email.to.toLowerCase(),
          )
        )
          throw new DeliveryError("permanent");
        return { providerId: messageId };
      } catch (error) {
        if (error instanceof DeliveryError) throw error;
        if (
          error &&
          typeof error === "object" &&
          "responseCode" in error &&
          typeof error.responseCode === "number" &&
          error.responseCode >= 400
        )
          throw new DeliveryError("permanent");
        throw new DeliveryError("unknown");
      }
    },
  };
}
