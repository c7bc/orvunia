import type { CodingDraft, WorkspaceOptions } from "./domain";
import { codingRegistry } from "./registry";
import { captureQueue } from "./captures";
import { languages } from "./languages";

export function createCodingWorkspace({
  createURL = (blob: Blob) => URL.createObjectURL(blob),
  revokeURL = (url: string) => URL.revokeObjectURL(url),
  maxSessions = 12,
  maxPendingBytes = 32 * 1024 * 1024,
  maxResponseRefs = 64,
}: WorkspaceOptions = {}) {
  if (
    !Number.isInteger(maxSessions) ||
    maxSessions < 1 ||
    maxSessions > 64 ||
    !Number.isInteger(maxPendingBytes) ||
    maxPendingBytes < 1 ||
    maxPendingBytes > 128 * 1024 * 1024 ||
    !Number.isInteger(maxResponseRefs) ||
    maxResponseRefs < 1 ||
    maxResponseRefs > 512
  )
    throw Error("Limite de contexto técnico inválido.");
  const registry = codingRegistry(maxSessions, revokeURL);
  return {
    get: registry.get,
    reserve: registry.reserve,
    get generation() {
      return registry.generation();
    },
    stats: () => ({
      ...registry.stats(),
      limits: { maxSessions, maxPendingBytes, maxResponseRefs },
    }),
    save(id: string, value: Partial<CodingDraft>) {
      const problem = String(value.problem || ""),
        code = String(value.code || ""),
        language = String(value.language || "");
      if (
        problem.length > 5000 ||
        code.length > 24000 ||
        (language && !languages.includes(language))
      )
        throw Error("Confira o tamanho do enunciado, do código e a linguagem.");
      const state = registry.reserve(id);
      Object.assign(state, { problem, code, language });
      if (typeof value.prefetchTellMore === "boolean")
        state.prefetchTellMore = value.prefetchTellMore;
      return state;
    },
    problem(id: string) {
      const state = registry.get(id);
      return [
        state.problem && `Problem statement:\n${state.problem}`,
        state.code &&
          `Candidate code (${state.language || "unspecified"}):\n${state.code}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    },
    ...captureQueue(registry, createURL, maxPendingBytes),
    rememberResponse(id: string, responseId: string, captureIds: string[]) {
      const state = registry.reserve(id);
      state.responseCaptures.delete(responseId);
      state.responseCaptures.set(responseId, [...captureIds]);
      while (state.responseCaptures.size > maxResponseRefs) {
        const oldest = state.responseCaptures.keys().next().value;
        if (oldest === undefined) break;
        state.responseCaptures.delete(oldest);
      }
    },
    responseCaptureIds: (id: string, responseId: string) => [
      ...(registry.get(id).responseCaptures.get(responseId) ?? []),
    ],
    attempt(id: string, value: unknown) {
      registry.reserve(id).attempt = value;
    },
    clear: registry.clear,
    dispose: registry.dispose,
  };
}
