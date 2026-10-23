export type NativeCaptureSource = {
  id: string;
  name: string;
  display_id: string;
  thumbnail: { toDataURL(): string };
};
export type NativeCaptureOptions = {
  types: ("screen" | "window")[];
  thumbnailSize?: { width: number; height: number };
  fetchWindowIcons?: boolean;
};
export function createNativeCapture(ports: {
  interactive(): void;
  sources(
    options: NativeCaptureOptions,
  ): Promise<readonly NativeCaptureSource[]>;
  selected(): string | null;
  select(id: string): void;
  clipboard(): string;
}) {
  let generation = 0;
  function identifier(value: unknown) {
    if (typeof value !== "string" || value.length > 512)
      throw Error("Fonte indisponível.");
    return value;
  }
  return {
    async list() {
      ports.interactive();
      const sources = await ports.sources({
        types: ["screen", "window"],
        thumbnailSize: { width: 460, height: 280 },
        fetchWindowIcons: true,
      });
      ports.interactive();
      return sources
        .filter(
          (source) =>
            !["Cadence", "Orvunia"].some((name) => source.name.startsWith(name)),
        )
        .map((source) => ({
          id: source.id,
          name: source.name,
          displayId: source.display_id,
          image: source.thumbnail.toDataURL(),
        }));
    },
    async select(value: unknown) {
      ports.interactive();
      const id = identifier(value),
        ticket = ++generation;
      const sources = await ports.sources({ types: ["screen", "window"] });
      ports.interactive();
      if (!sources.some((source) => source.id === id))
        throw Error("Fonte indisponível.");
      if (ticket !== generation)
        throw Error("A fonte selecionada foi alterada.");
      ports.select(id);
      return { id };
    },
    async capture(value?: unknown) {
      ports.interactive();
      const selected = value || ports.selected(),
        id = identifier(selected),
        ticket = ++generation;
      const sources = await ports.sources({
        types: ["screen", "window"],
        thumbnailSize: { width: 1920, height: 1080 },
      });
      ports.interactive();
      const source = sources.find((item) => item.id === id);
      if (!source) throw Error("Escolha uma tela ou janela.");
      if (ticket !== generation)
        throw Error("A fonte selecionada foi alterada.");
      ports.select(source.id);
      return { image: source.thumbnail.toDataURL(), name: source.name };
    },
    clipboard() {
      ports.interactive();
      return ports.clipboard().slice(0, 30000);
    },
  };
}
