export type AnswerNote = Readonly<{
  id: string;
  text: string;
  revision: number;
  edits: number;
}>;
export type AnswerInput = {
  requestId: string;
  mode: "recruiter" | "technical";
  action: string;
  question: string;
  sourceTranscriptIds?: string[];
  problem: string;
  codeLanguage: string;
  captureIds: string[];
};
export type AnswerRequest = {
  sessionId: string;
  input: AnswerInput;
  review: boolean;
  captureIds: string[];
  pendingIds: string[] | null;
  prepared: boolean;
  autoCapturePending: boolean;
  applyGenerated: AnswerNote | null;
  workspaceGeneration: number;
  needsAudioFlush: boolean;
  audioFlushed: boolean;
  sourceTranscriptIds?: string[];
};
export type AnswerAttempt = {
  text: string;
  cancelled: boolean;
  expired: boolean;
  message: string;
  request: AnswerRequest;
  input: AnswerInput;
  review: boolean;
};
export type AnswerOptions = {
  retry?: AnswerRequest;
  problemOverride?: string;
  codeLanguage?: string;
  captureIds?: string[];
  applyGenerated?: AnswerNote;
  sourceTranscriptIds?: string[];
};
export type AnswerSession = {
  id: string;
  mode: "recruiter" | "technical";
  state: string;
  transcripts: { id: string }[];
  responses: { id: string; action: string }[];
  captures: { id: string; url: string; title?: string; time?: string }[];
};
export const expiredContextMessage =
  "O contexto original expirou ou não está mais disponível. Faça uma nova pergunta com o contexto atual.";
export function answerFailure(error: unknown) {
  const value = error && typeof error === "object" ? error : {};
  return {
    name: "name" in value ? String(value.name) : "Error",
    message:
      "message" in value ? String(value.message) : "Falha ao pedir resposta.",
    status:
      "status" in value && typeof value.status === "number" ? value.status : 0,
  };
}
