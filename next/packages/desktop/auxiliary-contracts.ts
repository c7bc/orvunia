import { z } from "zod";

export const auxiliaryAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish"), revision: z.number().int().positive(),
    documentId: z.uuid(),
    html: z.string().max(262144), kind: z.enum(["menu", "modal", "select"]),
    theme: z.enum(["dark", "light"]), locale: z.enum(["pt-BR", "en", "es"]) }).strict(),
  z.object({ action: z.literal("hide") }).strict(),
  z.object({ action: z.literal("files"), accept: z.string().max(500), multiple: z.boolean() }).strict(),
  z.object({ action: z.literal("ready") }).strict(),
  z.object({ action: z.literal("resize"), height: z.number().int().min(60).max(1600) }).strict(),
  z.object({ action: z.literal("interact"), revision: z.number().int().positive(),
    documentId: z.uuid(),
    type: z.enum(["click", "input", "change", "keydown", "submit", "dismiss"]),
    target: z.string().max(40).optional(), value: z.string().max(100000).optional(),
    checked: z.boolean().optional(), key: z.string().max(40).optional(),
    shift: z.boolean().optional(), control: z.boolean().optional() }).strict(),
]);
export type AuxiliaryAction = z.infer<typeof auxiliaryAction>;
