export type SessionIndexItem = {
  id: string;
  mode: "recruiter" | "technical";
  title: string;
  state: "active" | "paused" | "ended";
  elapsed: number;
  date: string;
  modeId: string | null;
};
export type IndexQuery = {
  search: string;
  limit: number;
  before?: { date: string; id: string };
};
export interface SessionIndexRepository {
  find(workspaceId: string, query: IndexQuery): Promise<SessionIndexItem[]>;
}
