import type { PanelSession } from "../panel/data.js";
import type { SessionIndex } from "./contracts.js";

export interface CommandSearchPorts<Session extends PanelSession> {
  workspace(): string;
  input(): string | undefined;
  request(path: string): Promise<SessionIndex<Session>>;
  results(query: string, items: Session[]): void;
  error(message: string): void;
  schedule(callback: () => void, delay: number): number;
  cancel(timer: number): void;
}
export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}
export function findSessions<Session extends PanelSession>(
  sessions: Session[],
  query: string,
) {
  const needle = normalizeSearch(query.trim());
  return sessions
    .filter((session) =>
      normalizeSearch(
        `${session.title} ${session.transcripts.map((item) => item.text).join(" ")} ${session.responses.map((item) => item.text).join(" ")}`,
      ).includes(needle),
    )
    .slice(0, 6);
}
export function createCommandSearch<Session extends PanelSession>(
  ports: CommandSearchPorts<Session>,
) {
  let timer: number | null = null;
  let epoch = 0;
  function cancel() {
    epoch++;
    if (timer !== null) ports.cancel(timer);
    timer = null;
  }
  function search(query: string) {
    cancel();
    if (!query.trim()) return;
    const generation = epoch;
    const workspace = ports.workspace();
    const active = () =>
      generation === epoch &&
      workspace === ports.workspace() &&
      ports.input() === query;
    timer = ports.schedule(() => {
      timer = null;
      if (!active()) return;
      void ports
        .request(
          `/session-index?limit=6&search=${encodeURIComponent(query.slice(0, 200))}`,
        )
        .then((result) => {
          if (active()) ports.results(query, result.items);
        })
        .catch((error: unknown) => {
          if (active())
            ports.error(
              error instanceof Error
                ? error.message
                : "Falha ao buscar sessões.",
            );
        });
    }, 200);
  }
  return { search, cancel };
}
