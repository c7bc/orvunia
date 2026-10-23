import { expect, test } from "bun:test";
import { createHistoryPager } from "../../../client/history/pager.ts";
import type {
  PanelCapture,
  PanelPager,
  PanelResponse,
  PanelSession,
  PanelTranscript,
} from "../../../client/panel/data.ts";

test("history pages and filters preserve the selected collection's concrete item contract", () => {
  const session: PanelSession = {
    id: "typed",
    title: "Synthetic",
    state: "ended",
    elapsed: 1,
    date: "2026-10-15",
    responses: [{ id: "response", action: "assist", text: "Answer" }],
    transcripts: [
      { id: "transcript", text: "Question", who: "Interviewer", time: "00:01" },
    ],
    captures: [{ id: "capture", url: "/api/assets/synthetic" }],
  };
  const concrete = createHistoryPager();
  const compatible: PanelPager = concrete;
  const response: PanelResponse | undefined = concrete.page(
    session,
    "responses",
    { filter: (item) => item.action.toUpperCase() === "ASSIST" },
  ).items[0];
  const transcript: PanelTranscript | undefined = concrete.move(
    session,
    "transcripts",
    "latest",
  ).items[0];
  const capture: PanelCapture | undefined = concrete.page(session, "captures")
    .items[0];
  expect(response?.text).toBe("Answer");
  expect(transcript?.who).toBe("Interviewer");
  expect(capture?.url).toBe("/api/assets/synthetic");
  expect(
    compatible.page(session, "responses", { view: "panel-conversation" })
      .items[0]?.action,
  ).toBe("assist");
});
