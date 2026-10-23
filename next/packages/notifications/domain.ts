export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
};
export type DeliveryResult = { providerId: string };
export interface EmailTransport {
  send(id: string, email: Email): Promise<DeliveryResult>;
}
export interface EmailIntents {
  create(email: Email, expiresAt: Date, userId?: string): Promise<string>;
}
export class DeliveryError extends Error {
  constructor(readonly kind: "retryable" | "permanent" | "unknown") {
    super(kind);
  }
}
