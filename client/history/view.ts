export const historyKinds = ["responses", "transcripts", "captures"] as const;
export type HistoryKind = (typeof historyKinds)[number];
export type HistoryItem = {
  id: string;
  _position?: number;
  [key: string]: unknown;
};
export type HistoryWindow = {
  total: number;
  before: string | null;
  generation?: number;
  expanded?: boolean;
};
export type HistoryView = {
  id: string;
  responses: HistoryItem[];
  transcripts: HistoryItem[];
  captures: HistoryItem[];
  history?: Record<HistoryKind, HistoryWindow> & { generation: number };
};
export type HistoryPage = HistoryWindow & {
  generation: number;
  items: HistoryItem[];
};
export const orderedHistory = (items: HistoryItem[]) =>
  [...new Map(items.map((item) => [item.id, item])).values()].sort(
    (first, second) =>
      (first._position ?? Infinity) - (second._position ?? Infinity),
  );
export function historyTotal(
  session: HistoryView | null | undefined,
  kind: HistoryKind,
) {
  return session?.history?.[kind]?.total ?? session?.[kind]?.length ?? 0;
}
export const HISTORY_PAGE_SIZES = Object.freeze({
  responses: 20,
  transcripts: 80,
  captures: 30,
});
export type PageOptions<Item extends HistoryItem = HistoryItem> = {
  view?: string;
  filter?(item: Item): boolean;
};
export type PageAnchor = {
  generation: number | null;
  followingLatest: boolean;
  first: string | null;
  last: string | null;
};
