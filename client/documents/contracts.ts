export type ImportedDocument = { name: string; text: string };
export type ReferenceDocument = ImportedDocument & {
  id: string;
  date?: string;
};
export type ReferenceMode = { id: string; documents: ReferenceDocument[] };
export type ReferencePorts<Mode extends ReferenceMode> = {
  workspace(): string;
  modeId(): string;
  mode(id: string): Mode | undefined;
  native: { import(): Promise<ImportedDocument[]> } | null;
  choose(signal: AbortSignal): Promise<File[]>;
  extract(
    file: File,
    workspace: string,
    signal: AbortSignal,
  ): Promise<ImportedDocument>;
  save(
    modeId: string,
    documents: ReferenceDocument[],
    workspace: string,
    signal: AbortSignal,
  ): Promise<Mode>;
  replace(mode: Mode): void;
  changed(): void;
  render(): void;
  toast(message: string): void;
  identifier(): string;
  clock(): Date;
};
