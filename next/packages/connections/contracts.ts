import { z } from "zod";
const identifier = z.string().min(1).max(160).regex(/^[a-zA-Z0-9._-]+$/);
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const endpoint = z.url().max(500).refine((value) => {
  const url = new URL(value);
  return !url.username && !url.password && !url.search && !url.hash &&
    (url.protocol === "https:" || (url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]", "host.docker.internal"].includes(url.hostname)));
});
export const providers = z.enum(["openai", "anthropic", "gemini", "groq",
  "openrouter", "ollama", "compatible", "deepgram", "assemblyai"]);
const capability = z.enum(["text", "vision", "transcription"]);
const directBinding = [
  z.object({ kind: z.literal("api"), connectionId: identifier }).strict(),
  z.object({ kind: z.literal("local"), installationId: identifier }).strict(),
  z.object({ kind: z.literal("disabled") }).strict(),
] as const;
export const bindings = z.object({
  text: z.discriminatedUnion("kind", directBinding),
  vision: z.discriminatedUnion("kind", [...directBinding,
    z.object({ kind: z.literal("shared"), capability: z.literal("text") }).strict()]),
  transcription: z.discriminatedUnion("kind", directBinding),
}).strict();
const parameters = z.object({
  maxTokens: z.number().int().min(1).max(1_000_000).optional(),
  realtimeModel: z.string().max(160).optional(), vision: z.boolean().optional(),
}).strict();
const connection = {
  id: identifier, provider: providers, baseUrl: endpoint,
  model: z.string().trim().min(1).max(160), revision,
  capabilities: z.array(capability).min(1).max(3), parameters,
};
const secret = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("saved"), value: z.string().min(1).max(1000) }).strict(),
  z.object({ kind: z.literal("environment"), provider: providers, baseUrl: endpoint,
    role: z.enum(["response", "transcription"]) }).strict(),
]);
export const configuration = z.object({
  schemaVersion: z.literal(2), revision, bindings,
  connections: z.array(z.object({ ...connection, secretRef: identifier.optional() }).strict()).max(12),
  secrets: z.record(identifier, secret),
}).strict();
export const secretOperation = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("keep") }).strict(),
  z.object({ operation: z.literal("replace"), value: z.string().min(1).max(1000) }).strict(),
  z.object({ operation: z.literal("clear") }).strict(),
]);
export const replacement = z.object({
  schemaVersion: z.literal(2), expectedRevision: revision, bindings,
  connections: z.array(z.object({ ...connection, secret: secretOperation }).strict()).max(12),
}).strict();
export type Replacement = z.infer<typeof replacement>;
