export type SessionTitle = { id: string; title: string };
export type TitlePorts<Session extends SessionTitle> = {
  current(): Session | null;
  sessions(): Session[];
  replace(sessions: Session[]): void;
  save(id: string, title: string, signal: AbortSignal): Promise<unknown>;
  changed(): void;
  toast(message: string): void;
};
export type TitleSave = {
  value: string;
  promise: Promise<boolean>;
  controller: AbortController;
  version: number;
};
export function savedTitle(value: unknown): string {
  if (
    !value ||
    typeof value !== "object" ||
    !("title" in value) ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.length > 200
  )
    throw Error("O título retornado pelo servidor é inválido.");
  return value.title;
}
