import type { PanelSession } from "../panel/data.js";
import type { HistoryPorts } from "./contracts.js";
import { createSessionIndexSearch } from "./index-search.js";
import { createHistoryNavigation } from "./pagination.js";
import { createRecapReview } from "./recap.js";

export function createHistoryApplication<Session extends PanelSession>(
  ports: HistoryPorts<Session>,
) {
  const navigation = createHistoryNavigation(ports);
  const recap = createRecapReview(ports);
  return {
    searchSessionHistory: createSessionIndexSearch(ports),
    loadHistoryPage: navigation.load,
    moveHistory: navigation.move,
    reviewRecap: recap.review,
    showGeneratedRecapFallback: recap.fallback,
  };
}
