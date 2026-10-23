import type { AnswerDependencies } from "./dependencies.ts";
import type { AnswerInput } from "../contracts/answers.ts";
import type { OperationSnapshot } from "../operations/domain.ts";
import { OperationError } from "../operations/domain.ts";
import { buildInstructions } from "./instructions.ts";
import type { AnswerPreparationOptions } from "./preparation.ts";
import { capabilityProvider } from "../capabilities/snapshot.ts";
import { validateTranscriptSources } from "./transcript-sources.ts";
import { selectedModeConfiguration } from "./mode-prompt.ts";

export async function answerContext(
  dependencies: AnswerDependencies,
  workspaceId: string,
  id: string,
  input: AnswerInput,
  allowEnded: boolean,
  options: AnswerPreparationOptions = {},
): Promise<OperationSnapshot> {
  const { sessions, workspace, assets, providers } = dependencies;
  const session = await sessions.find(workspaceId, id);
  if (!session) throw new OperationError("conversation_not_found");
  await validateTranscriptSources(sessions, workspaceId, id, input.sourceTranscriptIds,
    session.historyGeneration, allowEnded);
  const context = await workspace.find(workspaceId);
  const modeConfiguration = selectedModeConfiguration(context, session.modeSnapshot, input.mode);
  let preferences = { ...context.preferences, modeInstructions: {
    ...context.preferences.modeInstructions,
    [input.mode]: modeConfiguration.instructions,
  } };
  let documents = context.library.documents.filter(
    (document) => !document.mode || document.mode === input.mode,
  );
  const mode = session.modeSnapshot;
  if (mode?.base === input.mode) {
    preferences = {
      ...preferences,
      noteTemplates: {
        ...preferences.noteTemplates,
        [input.mode]: mode.sections
          .map(
            (section) =>
              `## ${section.title.trim() || "Notas"}\n${section.instructions.trim()}`,
          )
          .join("\n\n"),
      },
    };
    documents = [
      ...context.library.documents.filter((document) => !document.mode),
      ...mode.documents,
    ];
  }
  const [transcripts, responses] = await Promise.all([
    sessions.entries(workspaceId, id, "transcripts", { limit: 80 }),
    sessions.entries(workspaceId, id, "responses", { limit: 3 }),
  ]);
  const captureIds =
    input.captureIds ??
    (await sessions.entries(workspaceId, id, "captures", { limit: 3 }))
      .reverse()
      .map((entry) => entry.id);
  const images = await Promise.all(
    captureIds.map(async (captureId) => {
      const asset = await assets.find(workspaceId, id, captureId);
      if (!asset || asset.state !== "ready")
        throw new OperationError("asset_not_found");
      return {
        id: asset.id,
        key: asset.objectKey,
        mime: asset.mime,
        hash: asset.hash,
        bytes: asset.bytes,
      };
    }),
  );
  const connection = providers.effective("response");
  const capabilities = await dependencies.capabilities?.resolvePlan();
  const provider = capabilities ? capabilityProvider(capabilities, "text") : {
    provider: connection.provider, baseUrl: connection.baseUrl, model: connection.model,
    vision: connection.vision, maxTokens: connection.maxTokens,
  };
  const instructions = buildInstructions({
    input,
    profile: context.profile,
    preferences,
    modeSystemPrompt: modeConfiguration.systemPrompt,
  });
  return {
    ...(capabilities ? { version: 2 as const, capabilities } : { version: 1 as const }),
    allowEnded,
    historyGeneration: session.historyGeneration,
    images,
    instructions: options.instructionTransform?.(instructions) ?? instructions,
    context: JSON.stringify({
      candidate: context.profile,
      job: context.profile?.description,
      documents: documents
        .map((document) => `${document.name}:\n${document.text}`)
        .join("\n\n")
        .slice(0, 50_000),
      transcript: transcripts.map((entry) => entry.data),
      previous_answers: responses.map((entry) =>
        entry.data.text.slice(0, 6000),
      ),
      question: input.question,
      ...(input.sourceTranscriptIds ? { sourceTranscriptIds: [...input.sourceTranscriptIds] } : {}),
      problem: input.problem,
    }),
    metadata: {
      action: input.action,
      mode: input.mode,
      question: input.question,
      ...(input.sourceTranscriptIds ? { sourceTranscriptIds: [...input.sourceTranscriptIds] } : {}),
    },
    provider: !capabilities && dependencies.selectResponseModel
      ? dependencies.selectResponseModel({ workspaceId, sessionId: id, modeId: mode?.id ?? input.mode, provider })
      : provider,
  };
}
