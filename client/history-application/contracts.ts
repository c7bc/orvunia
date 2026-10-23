import type { PanelSession } from "../panel/data.js";
import type { GeneratedNote } from "../notes/contracts.js";
import type { HistoryKind, HistoryPage } from "../history/view.js";
import type { createHistoryPager } from "../history/pager.js";

export type HistoryDirection = "older" | "newer" | "latest";
export interface HistoryState<Session extends PanelSession> {
  current: Session | null;
  sessions: Session[];
  search: string;
  sessionIndexBefore: string | null;
  sessionSearchItems: Session[];
  sessionSearchBefore: string | null;
  sessionSearchQuery: string;
  sessionSearchEpoch: number;
  busy: boolean;
  recapGeneration: GeneratedNote | null;
  generatedRecapFallback: { sessionId: string; text: string } | null;
}
export type SessionIndex<Session> = { items: Session[]; before: string | null };
export interface HistoryPorts<Session extends PanelSession> {
  state: HistoryState<Session>;
  workspace(): string;
  view(): string;
  index(path: string): Promise<SessionIndex<Session>>;
  history(path: string): Promise<HistoryPage>;
  merge(session: Session, kind: HistoryKind, page: HistoryPage): Session;
  pager: Pick<ReturnType<typeof createHistoryPager>, "move">;
  focus(): { current(): boolean; restore(): void } | null;
  render(): void;
  scrollAnswers(): void;
  updateSessionResults(): void;
  prepareGenerated(id: string): Promise<GeneratedNote>;
  ask(token: GeneratedNote): Promise<unknown>;
  presentRecapConfirmation(): void;
  presentGeneratedFallback(text: string, message: string): void;
}
