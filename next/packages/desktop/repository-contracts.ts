import { z } from "zod";

const owner = {
  workspaceId: z.string().min(1).max(128),
  actorId: z.string().min(1).max(128),
  sessionId: z.uuid(),
};
const revision = {
  ...owner,
  grantId: z.uuid(),
  revision: z.number().int().positive(),
  snapshotSha256: z.string().regex(/^[a-f0-9]{64}$/),
};
export const repositoryCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("select-prepared"), ...owner, modeId: z.string().min(1).max(128) }).strict(),
  z.object({ action: z.literal("cancel"), ...owner }).strict(),
  z.object({ action: z.literal("select"), ...owner,
    scope: z.array(z.string().min(1).max(240)).min(1).max(20), noticeVersion: z.literal(1).optional() }).strict(),
  z.object({ action: z.literal("preview"), ...revision }).strict(),
  z.object({ action: z.literal("approve"), ...revision, consent: z.literal(true) }).strict(),
  z.object({ action: z.literal("list"), ...revision }).strict(),
  z.object({ action: z.literal("read"), ...revision, path: z.string().min(1).max(240),
    fromLine: z.number().int().positive(), toLine: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("search"), ...revision, query: z.string().min(2).max(128),
    path: z.string().min(1).max(240).optional() }).strict(),
  z.object({ action: z.literal("refresh"), ...revision }).strict(),
  z.object({ action: z.literal("revoke"), ...revision }).strict(),
]);

export const repositoryBinding = z.object(owner).strict();
