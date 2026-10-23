import type { Workspace } from "../workspaces/domain.ts";
import type { SessionRecord, HistoryEntry } from "../sessions/domain.ts";
import type { Notes } from "../conversations/domain.ts";
import type { Asset } from "../assets/domain.ts";
import type { SupplementalProjection } from "./supplemental.ts";
import type { Operation } from "../operations/domain.ts";
import type { ExpansionStage } from "../expansions/domain.ts";
import type { CalendarRecord } from "../calendar/domain.ts";
import type { ReceiptProjection } from "./receipts.ts";
import type { BillingProjection } from "./billing.ts";

export type LegacyProjection = {
  workspaces: Workspace[];
  sessions: SessionRecord[];
  entries: HistoryEntry[];
  notes: { conversationId: string; value: Notes }[];
  images: { asset: Asset; data: Uint8Array }[];
  supplemental: SupplementalProjection;
  operations: Operation[];
  expansions: ExpansionStage[];
  calendars: CalendarRecord[];
  receipts: ReceiptProjection;
  billing: BillingProjection;
  unhandled: { table: string; rows: number }[];
};
export type ImportManifest = {
  format: "cadence-migration-staging/1";
  runId: string;
  sourceHash: string;
  createdAt: string;
  counts: {
    workspaces: number;
    sessions: number;
    entries: number;
    images: number;
    notes: number;
  };
  unhandled: { table: string; rows: number }[];
  cutoverAllowed: false;
  supplemental: { drafts: number; deliveries: number; reservations: number };
  receipts: { uploads: number; segments: number };
  billing: { accounts: number; events: number; reconciliation: number };
  installation?: {
    onboarding: number;
    calendars: number;
    privateFiles: number;
    archives: { name: string; sha256: string }[];
  };
  identity?: {
    users: number;
    sessions: number;
    accounts: number;
    aliases: number;
    retiredAliases: number;
    devices: number;
  };
};
