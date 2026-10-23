export function createNativeExport(ports: {
  interactive(): void;
  choose(options: {
    defaultPath: string;
    filters: { name: string; extensions: string[] }[];
  }): Promise<{ canceled: boolean; filePath?: string }>;
  write(filename: string, text: string): Promise<void>;
  signal: AbortSignal;
}) {
  let pending: Promise<{ canceled: true } | { saved: true }> | null = null;
  return (value: unknown) => {
    ports.interactive();
    ports.signal.throwIfAborted();
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("Arquivo inválido.");
    const fields = value as Record<string, unknown>;
    if (typeof fields.text !== "string" || fields.text.length > 2000000)
      throw Error("Arquivo inválido.");
    if (pending) throw Error("Conclua o salvamento em andamento.");
    const text = fields.text;
    const name =
      String(fields.name || "sessao")
        .replace(/[^\p{L}\p{N} _.-]/gu, "")
        .slice(0, 120) || "sessao";
    pending = (async () => {
      const result = await ports.choose({
        defaultPath: `${name}.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      ports.signal.throwIfAborted();
      ports.interactive();
      if (result.canceled) return { canceled: true } as const;
      if (!result.filePath) throw Error("Arquivo inválido.");
      await ports.write(result.filePath, text);
      return { saved: true } as const;
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
