export function writeNativeClipboard(clipboard: { writeText?(text: string): void }, value: unknown) {
  if (typeof value !== "string" || value.length > 512 * 1024 || value.includes("\0"))
    throw Error("Texto inválido para copiar.");
  if (!clipboard.writeText) throw Error("A área de transferência não está disponível.");
  clipboard.writeText(value);
  return { copied: true };
}
