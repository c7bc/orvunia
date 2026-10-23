import { z } from "zod";

// Historical records are retained for recovery; this module cannot execute payments.
export type ArchivedAccount = {
  workspaceId: string; planId: string; status: string; periodEnd: number;
  customerId: string | null; subscriptionId: string | null;
};
type ArchivedIntent = { key: string; startedAt: number; token: string; leaseUntil: number };
export type ArchivedPayment = {
  workspaceId: string; revision: number; customer: ArchivedIntent | null;
  checkout: (ArchivedIntent & {
    requestId: string; planId: string; priceId: string; url: string; expiresAt: number;
    sessionId: string; state: "creating" | "ready" | "unknown" | "expired" | "completed";
  }) | null;
};
export const archivedIdentifier = (prefix: "cus" | "sub" | "evt") =>
  z.string().regex(new RegExp(`^${prefix}_[a-zA-Z0-9]+$`)).max(200);
export function archivedCheckoutUrl(value: string) {
  const url = new URL(z.url().parse(value));
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" ||
      url.port || url.username || url.password) throw Error("Invalid archived checkout URL");
  return url.href;
}
