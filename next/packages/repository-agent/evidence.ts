export function repositoryModelEvidence(output: string) {
  let value: unknown;
  try { value = JSON.parse(output); } catch { return output; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return output;
  const record = value as Record<string, unknown>;
  if (typeof record.text !== "string" || typeof record.path !== "string"
    || !Number.isSafeInteger(record.fromLine) || !Number.isSafeInteger(record.toLine)
    || Number(record.fromLine) < 1) return output;
  const lines = record.text.split(/\r?\n/);
  if (lines.length !== Number(record.toLine) - Number(record.fromLine) + 1) return output;
  const { text: _text, ...metadata } = record;
  return JSON.stringify({ ...metadata,
    sourceLines: lines.map((text, index) => ({ line: Number(record.fromLine) + index, text })) });
}
