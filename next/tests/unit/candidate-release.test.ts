import { expect, test } from "bun:test";
import { assertCandidateContents } from "../../packages/desktop/candidate-release.ts";

test("candidate installer refuses mismatched native/client generations, including removed, newly added and duplicate resources", () => {
  const expected = [
    { path: "desktop.js", sha256: "a" },
    { path: "session-commands.js", sha256: "b" },
  ];
  expect(() =>
    assertCandidateContents(expected, [...expected].reverse(), "client"),
  ).not.toThrow();
  for (const packaged of [
    expected.slice(1),
    [...expected, { path: "old.js", sha256: "c" }],
    [expected[0]!, expected[0]!],
    [expected[0]!, { path: "session-commands.js", sha256: "changed" }],
  ])
    expect(() => assertCandidateContents(expected, packaged, "client")).toThrow(
      "differs",
    );
});
