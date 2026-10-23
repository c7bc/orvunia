import { expect, test } from "bun:test";
import { updatedNotes } from "../../packages/conversations/notes.ts";

test("note decisions are pure, idempotent and reject unsafe revisions", () => {
  const current = {
    text: "Draft",
    revision: 4,
    updatedAt: "2026-10-15T00:00:00.000Z",
  };
  expect(updatedNotes(current, { text: "Draft", revision: 0 }, "later")).toBe(
    current,
  );
  expect(() =>
    updatedNotes(current, { text: "New", revision: 3 }, "later"),
  ).toThrow("notes_conflict");
  expect(() =>
    updatedNotes(current, { text: "New", revision: -1 }, "later"),
  ).toThrow("invalid_input");
  expect(() =>
    updatedNotes(
      { ...current, revision: Number.MAX_SAFE_INTEGER },
      { text: "New", revision: Number.MAX_SAFE_INTEGER },
      "later",
    ),
  ).toThrow("invalid_input");
  expect(updatedNotes(current, { text: "New", revision: 4 }, "later")).toEqual({
    text: "New",
    revision: 5,
    updatedAt: "later",
  });
  expect(current.text).toBe("Draft");
});
