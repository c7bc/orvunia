import assert from "node:assert/strict";
export async function seedStore(sessions, workspaceId, selected, date = new Date().toISOString()) {
  await sessions.create({ id: selected.sessionId, workspaceId,
    title: "Synthetic report and clipboard QA", mode: "technical", state: "active",
    createdAt: date, elapsed: 0, question: "Synthetic QA only", modeSnapshot: null,
    historyGeneration: 0, revision: 0 });
  await sessions.change(workspaceId, selected.sessionId, current => ({ next: { ...current, state: "ended" },
    append: { id: selected.responseId, conversationId: selected.sessionId, kind: "responses", segmentId: null,
      data: { id: selected.responseId, text: selected.answer, action: "assist", mode: "technical",
        model: "synthetic-qa-no-provider", date, question: "Synthetic QA only", captureIds: [] } } }));
  assert.equal((await sessions.counts(workspaceId, selected.sessionId)).responses, 1);
}
