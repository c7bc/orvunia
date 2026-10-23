import type { SessionIndexRepository } from "./projection.ts";
import { foldSearch } from "./fold.ts";
import { indexCursor } from "../contracts/index.ts";
import { SessionError } from "../sessions/domain.ts";

export function sessionIndex(repository: SessionIndexRepository) {
  return {
    async page(
      workspaceId: string,
      query: { before?: string; limit: number; search: string },
    ) {
      let cursor: ReturnType<typeof indexCursor.parse> | undefined;
      if (query.before) {
        try {
          cursor = indexCursor.parse(
            JSON.parse(Buffer.from(query.before, "base64url").toString("utf8")),
          );
        } catch {
          throw new SessionError("invalid_input");
        }
        if (cursor.owner !== workspaceId || cursor.search !== query.search)
          throw new SessionError("invalid_input");
      }
      const rows = await repository.find(workspaceId, {
        search: foldSearch(query.search),
        limit: query.limit + 1,
        ...(cursor ? { before: { date: cursor.date, id: cursor.id } } : {}),
      });
      const more = rows.length > query.limit,
        items = rows.slice(0, query.limit),
        last = items.at(-1);
      return {
        items: items.map((row) => ({
          ...row,
          question: "",
          transcripts: [],
          captures: [],
          responses: [],
          indexOnly: true,
        })),
        before:
          more && last
            ? Buffer.from(
                JSON.stringify({
                  owner: workspaceId,
                  kind: "index",
                  date: last.date,
                  id: last.id,
                  search: query.search,
                }),
              ).toString("base64url")
            : null,
      };
    },
  };
}
export type SessionIndex = ReturnType<typeof sessionIndex>;
