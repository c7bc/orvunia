import { and, eq, inArray, lte, gt, lt, sql } from "drizzle-orm";
import type { FollowupOutbox } from "../../followups/repository.ts";
import type { FollowupCipher } from "../../followups/cipher.ts";
import type { SqliteConnection } from "./connection.ts";
import { deliveries, mailAttempts } from "./followup-schema.ts";
export function sqliteFollowupOutbox(
  connection: SqliteConnection,
  cipher: FollowupCipher,
  clock = Date.now,
): FollowupOutbox {
  const database = connection.database;
  return {
    async pending(limit) {
      return database
        .select({ id: deliveries.id })
        .from(deliveries)
        .where(
          and(
            inArray(deliveries.state, ["pending", "queued"]),
            gt(deliveries.expiresAt, clock()),
            lte(deliveries.retryAt, clock()),
            lt(deliveries.attempts, 3),
          ),
        )
        .orderBy(deliveries.createdAt, deliveries.id)
        .limit(limit)
        .all()
        .map((row) => row.id);
    },
    async queued(id) {
      database
        .update(deliveries)
        .set({ state: "queued" })
        .where(and(eq(deliveries.id, id), eq(deliveries.state, "pending")))
        .run();
    },
    async claim(id) {
      const row = database
        .update(deliveries)
        .set({
          state: "processing",
          claimedAt: clock(),
          attempts: sql`${deliveries.attempts}+1`,
        })
        .where(
          and(
            eq(deliveries.id, id),
            inArray(deliveries.state, ["pending", "queued"]),
            gt(deliveries.expiresAt, clock()),
            lte(deliveries.retryAt, clock()),
            lt(deliveries.attempts, 3),
          ),
        )
        .returning({ ciphertext: deliveries.ciphertext })
        .get();
      if (!row) return null;
      try {
        return await cipher.open(row.ciphertext);
      } catch {
        database
          .update(deliveries)
          .set({ state: "failed", ciphertext: "" })
          .where(and(eq(deliveries.id, id), eq(deliveries.state, "processing")))
          .run();
        return null;
      }
    },
    async complete(id, providerId) {
      database
        .update(deliveries)
        .set({ state: "completed", providerId, ciphertext: "" })
        .where(and(eq(deliveries.id, id), eq(deliveries.state, "processing")))
        .run();
    },
    async fail(id, state) {
      database
        .update(deliveries)
        .set({
          state,
          retryAt: clock() + 1000,
          ...(state === "failed" ? { ciphertext: "" } : {}),
        })
        .where(and(eq(deliveries.id, id), eq(deliveries.state, "processing")))
        .run();
    },
    async attempts(id) {
      return (
        database
          .select({ attempts: deliveries.attempts })
          .from(deliveries)
          .where(eq(deliveries.id, id))
          .get()?.attempts ?? 0
      );
    },
    async recover() {
      const now = clock();
      database
        .update(deliveries)
        .set({ state: "unknown" })
        .where(
          and(
            eq(deliveries.state, "processing"),
            lt(deliveries.claimedAt, now - 180000),
          ),
        )
        .run();
      database
        .update(deliveries)
        .set({ state: "expired", ciphertext: "" })
        .where(
          and(
            inArray(deliveries.state, [
              "pending",
              "queued",
              "failed",
              "unknown",
            ]),
            lte(deliveries.expiresAt, now),
          ),
        )
        .run();
      database
        .update(deliveries)
        .set({ state: "failed", ciphertext: "" })
        .where(
          and(
            inArray(deliveries.state, ["pending", "queued"]),
            sql`${deliveries.attempts} >= 3`,
          ),
        )
        .run();
      database
        .delete(mailAttempts)
        .where(lt(mailAttempts.createdAt, now - 172800000))
        .run();
    },
  };
}
