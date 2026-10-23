import type { ExpansionDependencies } from "./dependencies.ts";
import { ExpansionError } from "./domain.ts";
import type { Operation, OperationSnapshot } from "../operations/domain.ts";
import { OperationError } from "../operations/domain.ts";
import { buildInstructions } from "../answers/instructions.ts";
import { answerSchema } from "../contracts/answers.ts";
import { capabilityProvider } from "../capabilities/snapshot.ts";
import { selectedModeConfiguration } from "../answers/mode-prompt.ts";

export async function expansionContext(
  dependencies: ExpansionDependencies,
  workspaceId: string,
  conversationId: string,
  sourceId: string,
  requestId: string,
) {
  const session = await dependencies.sessions.find(workspaceId, conversationId);
  if (!session) throw new OperationError("conversation_not_found");
  const source = await dependencies.sessions.entry(
    workspaceId,
    conversationId,
    sourceId,
    "responses",
  );
  if (!source) throw new ExpansionError("response_not_found");
  const mode = source.data.mode;
  if (mode !== "recruiter" && mode !== "technical")
    throw new OperationError("request_conflict");
  let original: Operation | null = null;
  for (const kind of ["answer", "expansion", "followup"] as const) {
    original = await dependencies.operations.find(workspaceId, kind, sourceId);
    if (original) break;
  }
  if (
    original &&
    (!original.snapshot || original.expiresAt <= dependencies.clock())
  )
    original = null;
  const workspace = await dependencies.workspace.find(workspaceId);
  const configuration = selectedModeConfiguration(workspace, session.modeSnapshot, mode);
  const question =
    "Explain the saved answer in more detail. State missing context instead of inventing it.";
  const input = answerSchema.parse({
    requestId,
    mode,
    question,
    action: "explain",
  });
  const parameters = dependencies.providers.effective("response");
  const capabilities = original?.snapshot?.version === 2 ? original.snapshot.capabilities :
    await dependencies.capabilities?.resolvePlan();
  const instructions =
    original?.snapshot?.instructions ??
    buildInstructions({
      input,
      profile: null,
      modeSystemPrompt: configuration.systemPrompt,
      preferences: { ...workspace.preferences, modeInstructions: {
        ...workspace.preferences.modeInstructions, [mode]: configuration.instructions,
      } },
    });
  const snapshot: OperationSnapshot = {
    ...(capabilities ? { version: 2 as const, capabilities } : { version: 1 as const }),
    allowEnded: true,
    historyGeneration: session.historyGeneration,
    instructions:
      instructions +
      "\nExplain the saved answer in more detail. Preserve the original factual constraints; state missing context instead of inventing it.",
    context: JSON.stringify({
      original_context: original?.snapshot?.context ?? null,
      saved_answer: source.data.text.slice(0, 30_000),
      question,
    }),
    images: original?.snapshot?.images ?? [],
    ...(original
      ? { retainedFrom: { kind: original.kind, id: original.id } }
      : {}),
    provider: capabilities ? capabilityProvider(capabilities, "text") : {
      provider: parameters.provider,
      baseUrl: parameters.baseUrl,
      model: parameters.model,
      vision: parameters.vision,
      maxTokens: parameters.maxTokens,
    },
    metadata: {
      action: "explain",
      mode,
      question: source.data.question ?? "",
      publish: false,
    },
  };
  return {
    snapshot,
    contextSource: original
      ? ("original-snapshot" as const)
      : ("saved-answer-only" as const),
  };
}
