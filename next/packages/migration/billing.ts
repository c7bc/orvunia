import { createHash } from "node:crypto";
import { z } from "zod";
import type { LegacyReader } from "./reader.ts";
import type { LegacyProjection } from "./projection.ts";
import type { ArchivedAccount, ArchivedPayment } from "./archived-payments.ts";
import { archivedIdentifier as stripeId, archivedCheckoutUrl } from "./archived-payments.ts";
export type BillingProjection = {
  accounts: ArchivedAccount[];
  payments: ArchivedPayment[];
  events: { id: string; createdAt: number }[];
  reconciliation: string[];
};
const nonnegative = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const accountSchema = z.object({
  owner: z.uuid(),
  customer: stripeId("cus").nullable(),
  subscription: stripeId("sub").nullable(),
  plan: z.string().min(1).max(100),
  status: z.string().min(1).max(100),
  period_end: nonnegative.max(Math.floor(Number.MAX_SAFE_INTEGER / 1000)),
  checkout_key: z.string().min(1).max(200).nullable(),
  checkout_url: z.string().nullable(),
  checkout_expires: nonnegative,
});
export function projectBilling(
  reader: LegacyReader,
  projection: LegacyProjection,
): BillingProjection {
  const owners = new Set(projection.workspaces.map((value) => value.id)),
    customers = new Set<string>(),
    subscriptions = new Set<string>();
  const result: BillingProjection = {
    accounts: [],
    payments: [],
    events: [],
    reconciliation: [],
  };
  for (const row of reader.rows("billing_accounts")) {
    const account = accountSchema.parse(row);
    if (
      !owners.has(account.owner) ||
      (account.customer && customers.has(account.customer)) ||
      (account.subscription &&
        (subscriptions.has(account.subscription) || !account.customer))
    )
      throw Error("Legacy billing account has inconsistent ownership");
    if (account.customer) customers.add(account.customer);
    if (account.subscription) subscriptions.add(account.subscription);
    result.accounts.push({
      workspaceId: account.owner,
      customerId: account.customer,
      subscriptionId: account.subscription,
      planId: account.plan,
      status: account.status,
      periodEnd: account.period_end * 1000,
    });
    const hash = createHash("sha256").update(account.owner).digest("hex");
    const payment: ArchivedPayment = {
      workspaceId: account.owner,
      revision: 0,
      customer: account.customer
        ? null
        : {
            key: hash,
            startedAt: 0,
            token: "",
            leaseUntil: 0,
          },
      checkout: null,
    };
    if (account.checkout_key) {
      const match = /^([a-zA-Z0-9_-]+):([a-fA-F0-9-]{36})$/.exec(
        account.checkout_key,
      );
      if (!match || !match[1]) throw Error("Invalid legacy checkout identity");
      const requestId = z.uuid().parse(match[2]);
      payment.checkout = {
        key: `${hash}-${account.checkout_key}`,
        requestId,
        planId: match[1],
        priceId: "",
        startedAt: 0,
        token: "",
        leaseUntil: 0,
        state: "unknown",
        sessionId: "",
        url: account.checkout_url
          ? archivedCheckoutUrl(account.checkout_url)
          : "",
        expiresAt: account.checkout_expires,
      };
    } else if (account.checkout_url || account.checkout_expires)
      throw Error("Legacy checkout is missing its request identity");
    if (payment.checkout || payment.customer)
      result.reconciliation.push(account.owner);
    result.payments.push(payment);
  }
  for (const row of reader.rows("billing_events")) {
    const event = z
      .object({ id: stripeId("evt"), processed: nonnegative })
      .parse(row);
    result.events.push({ id: event.id, createdAt: event.processed });
  }
  return result;
}
