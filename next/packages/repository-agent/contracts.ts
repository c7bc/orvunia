import { z } from "zod";
import { normalizeRepositoryScope, repositoryPathPolicy } from "../repository-context/policy.ts";
import { sourceTranscriptIdsSchema } from "../contracts/answers.ts";

const path = z.string().max(240).refine((value) => {
  try { return normalizeRepositoryScope(value) === value && !repositoryPathPolicy(value, false); }
  catch { return false; }
});
export const bindingSchema = z.object({ grantId: z.string().min(1).max(128),
  revision: z.number().int().positive(), snapshotSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const startSchema = z.object({ requestId: z.string().uuid(), consent: z.literal(true),
  question: z.string().trim().min(1).max(8_000), binding: bindingSchema,
  sourceTranscriptIds: sourceTranscriptIdsSchema.optional() }).strict();
export const toolArguments = {
  repository_list: z.object({}).strict(),
  repository_search: z.object({ query: z.string().min(2).max(128), path: path.nullable() }).strict(),
  repository_read: z.object({ path, fromLine: z.number().int().positive(),
    toLine: z.number().int().positive() }).strict().refine((value) =>
    value.toLine >= value.fromLine && value.toLine - value.fromLine < 200),
};
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const file = z.object({ path, sha256: hash, bytes: z.number().int().nonnegative(), lines: z.number().int().positive() });
const list = bindingSchema.extend({ files: z.array(file).max(200) }).strip();
const read = bindingSchema.extend({ path, sha256: hash, fromLine: z.number().int().positive(),
  toLine: z.number().int().positive(), text: z.string().max(16_384) }).strict();
const search = bindingSchema.extend({ query: z.string().min(2).max(128), more: z.boolean(),
  matches: z.array(z.object({ path, sha256: hash, line: z.number().int().positive(),
    text: z.string().max(500), truncated: z.boolean() }).strict()).max(20) }).strict();
const recoverableError = bindingSchema.extend({ error: z.object({
  code: z.enum(["repository_file_not_found", "repository_line_range_invalid"]),
  tool: z.enum(["repository_read", "repository_search"]),
}).strict() }).strict();
export const toolResults = { repository_list: list,
  repository_read: z.union([read, recoverableError]), repository_search: z.union([search, recoverableError]) };
export type ToolName = keyof typeof toolArguments;
export const toolReplySchema = z.object({ callId: z.string().min(1).max(128),
  token: z.string().uuid(), result: z.unknown() }).strict();
