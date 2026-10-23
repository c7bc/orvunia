import type { LegacyReader } from "./reader.ts";
import type { LegacyProjection } from "./projection.ts";
import { projectWorkspaces } from "./workspaces.ts";
import { projectSessions } from "./sessions.ts";
import { projectSupplemental } from "./supplemental.ts";
import { projectOperations } from "./operations.ts";
import { projectExpansions } from "./expansions.ts";
import { projectReceipts } from "./receipts.ts";
import { projectBilling } from "./billing.ts";
import { projectAudioHolds } from "./audio-holds.ts";

const handled = new Set([
  "owners",
  "modes",
  "sessions",
  "transcripts",
  "responses",
  "captures",
  "session_notes",
  "followup_drafts",
  "followup_deliveries",
  "billing_usage",
  "tell_me_more",
  "capture_uploads",
  "empty_transcriptions",
  "billing_accounts",
  "billing_events",
]);
export function projectLegacy(
  reader: LegacyReader,
  runId: string,
  now: string,
): LegacyProjection {
  if (!reader.tables.has("owners") || !reader.tables.has("sessions"))
    throw Error("This is not a Cadence data database");
  const projection: LegacyProjection = {
    workspaces: projectWorkspaces(reader, now),
    sessions: [],
    entries: [],
    notes: [],
    images: [],
    supplemental: { drafts: [], deliveries: [], reservations: [] },
    operations: [],
    expansions: [],
    calendars: [],
    receipts: { uploads: [], segments: [] },
    billing: { accounts: [], payments: [], events: [], reconciliation: [] },
    unhandled: [...reader.tables]
      .filter((table) => !handled.has(table))
      .map((table) => ({
        table,
        rows: reader.count(table),
      }))
      .filter((table) => table.rows > 0),
  };
  projectSessions(reader, projection, runId);
  projection.receipts = projectReceipts(reader, projection);
  projection.billing = projectBilling(reader, projection);
  const requests = projectOperations(
    reader,
    projection,
    runId,
    Date.parse(now),
  );
  projectExpansions(reader, projection, Date.parse(now));
  projection.unhandled = projection.unhandled.filter(
    (value) => !requests.has(value.table),
  );
  projection.supplemental = projectSupplemental(
    reader,
    projection,
    Date.parse(now),
  );
  projectAudioHolds(projection, Date.parse(now));
  return projection;
}
