export function isUtteranceIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function utteranceFields(value: unknown): { utteranceId?: string } {
  if (value === undefined) return {};
  if (!isUtteranceIdentifier(value)) throw Error("Evento de áudio inválido.");
  return { utteranceId: value };
}
