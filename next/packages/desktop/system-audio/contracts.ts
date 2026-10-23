import { z } from "zod";

const endpoint = z.string().min(1).max(2048).regex(/^[^\0\r\n]+$/);
export const endpointSelection = z.union([
  z.enum(["default:console", "default:multimedia", "default:communications"]),
  endpoint.regex(/^\{0\.0\.0\.00000000\}\.\{[a-fA-F0-9-]{36}\}$/),
]);
export const endpointCatalog = z.object({ supported: z.boolean(),
  endpoints: z.array(z.object({ id: endpoint, name: z.string().min(1).max(512),
    defaultConsole: z.boolean(), defaultMultimedia: z.boolean(), defaultCommunications: z.boolean() }).strict()).max(256),
  defaults: z.object({ console: endpoint.nullable(), multimedia: endpoint.nullable(), communications: endpoint.nullable() }).strict(),
}).strict();
const captureId = z.uuid();
export const systemAudioRequest = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }).strict(),
  z.object({ action: z.literal("start"), captureId, sessionId: z.uuid(), endpointId: endpointSelection,
    consent: z.literal(true) }).strict(),
  z.object({ action: z.literal("ack"), captureId, sequence: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal("flush"), captureId, id: z.uuid() }).strict(),
  z.object({ action: z.literal("stop"), captureId }).strict(),
]);
export const helperEvent = z.discriminatedUnion("event", [
  z.object({ event: z.literal("ready"), endpointId: endpoint, sampleRate: z.literal(24000),
    channels: z.literal(1), format: z.literal("pcm_s16le"),
    sourceSampleRate: z.number().int().positive().max(768000).optional(),
    sourceChannels: z.number().int().positive().max(64).optional() }).strict(),
  z.object({ event: z.literal("flushed"), id: z.uuid(), frames: z.number().int().nonnegative().max(24000 * 86400) }).strict(),
  z.object({ event: z.literal("stopped"), frames: z.number().int().nonnegative(),
    discontinuities: z.number().int().nonnegative() }).strict(),
  z.object({ event: z.literal("error"), code: z.string().regex(/^[a-z_]{1,80}$/),
    hresult: z.union([z.number().int(), z.string().max(32)]).optional() }).strict(),
]);
export type SystemAudioCatalog = z.infer<typeof endpointCatalog>;
export type HelperEvent = z.infer<typeof helperEvent>;
export const unsupportedCatalog = (): SystemAudioCatalog => ({ supported: false, endpoints: [],
  defaults: { console: null, multimedia: null, communications: null } });
