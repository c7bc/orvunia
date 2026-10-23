export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Resposta inválida do servidor.");
  return value as Record<string, unknown>;
}
export function text(value: unknown): string {
  if (typeof value !== "string") throw Error("Resposta inválida do servidor.");
  return value;
}
export function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw Error("Resposta inválida do servidor.");
  return value;
}
export function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw Error("Resposta inválida do servidor.");
  return value;
}
export function array<Value>(
  value: unknown,
  read: (item: unknown) => Value,
): Value[] {
  if (!Array.isArray(value)) throw Error("Resposta inválida do servidor.");
  return value.map(read);
}
