import { z } from "zod";
import type { LegacyReader } from "./reader.ts";
import type { LegacyProjection } from "./projection.ts";
import type { Draft, Delivery } from "../followups/domain.ts";
import type { Reservation } from "../accounting/domain.ts";
import { unmeasuredUsage } from "../accounting/domain.ts";
export type SupplementalProjection = {
  drafts: (Draft & { workspaceId: string; conversationId: string })[];
  deliveries: Delivery[];
  reservations: Reservation[];
};
const identifier = z.uuid(),
  integer = z.number().int().nonnegative(),
  stamp = z.iso
    .datetime({ offset: true })
    .transform((value) => Date.parse(value));
const draft = z.object({
  owner: identifier,
  session: identifier,
  recipient: z.union([z.email(), z.literal("")]),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(30000),
  revision: integer.positive(),
  updated_at: z.string().min(1),
});
const delivery = z.object({
  id: identifier,
  owner: identifier,
  session: identifier,
  revision: integer.positive(),
  request_id: identifier,
  draft_hash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["sending", "accepted", "rejected", "unconfirmed"]),
  message_id: z.string().max(500),
  created_at: stamp,
});
const usage = z.object({
  id: identifier,
  owner: identifier,
  request_key: z.string().min(1).max(200),
  kind: z.enum(["answers", "transcriptionSeconds"]),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  reserved: integer.positive().max(10000000),
  actual: integer.max(10000000),
  state: z.enum(["reserved", "committed", "released"]),
  expires: integer,
});
export function projectSupplemental(
  reader: LegacyReader,
  projection: LegacyProjection,
  now: number,
): SupplementalProjection {
  const owners = new Set(projection.workspaces.map((value) => value.id)),
    sessions = new Map(
      projection.sessions.map((value) => [value.id, value.workspaceId]),
    );
  function owned(owner: string, session?: string) {
    if (
      !owners.has(owner) ||
      (session !== undefined && sessions.get(session) !== owner)
    )
      throw Error("Legacy auxiliary data has inconsistent ownership");
  }
  return {
    drafts: reader.rows("followup_drafts").map((row) => {
      const value = draft.parse(row);
      owned(value.owner, value.session);
      return {
        workspaceId: value.owner,
        conversationId: value.session,
        recipient: value.recipient,
        subject: value.subject,
        body: value.body,
        revision: value.revision,
        updatedAt: value.updated_at,
      };
    }),
    deliveries: reader.rows("followup_deliveries").map((row) => {
      const value = delivery.parse(row);
      owned(value.owner, value.session);
      return {
        id: value.id,
        workspaceId: value.owner,
        conversationId: value.session,
        revision: value.revision,
        requestId: value.request_id,
        draftHash: value.draft_hash,
        state:
          value.status === "accepted"
            ? "completed"
            : value.status === "rejected"
              ? "failed"
              : "unknown",
        providerId: value.message_id,
        createdAt: value.created_at,
        ciphertext: "",
        expiresAt: value.created_at + 86400000,
        claimedAt: null,
        attempts: 1,
        retryAt: 0,
      };
    }),
    reservations: reader.rows("billing_usage").map((row) => {
      const value = usage.parse(row);
      owned(value.owner);
      if (value.actual > value.reserved)
        throw Error("Legacy usage exceeds its reserved amount");
      return {
        id: value.id,
        workspaceId: value.owner,
        requestKey: value.request_key,
        kind: value.kind,
        period: value.period,
        units: value.reserved,
        actual: value.actual,
        state: value.state === "reserved" ? "unknown" : value.state,
        createdAt: now,
        leaseUntil: 0,
        measurement: { ...unmeasuredUsage },
      };
    }),
  };
}
