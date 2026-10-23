export type ExpansionResponse = { id: string; text: string };
export type ExpansionValue = {
  status: "absent" | "generating" | "ready" | "revealed" | "expired" | "failed";
  requestId?: string | null;
  captureIds?: string[];
  contextSource?: string;
  cancelled?: boolean;
  response?: ExpansionResponse;
  message?: string;
};
export type ExpansionState = ExpansionValue & {
  sessionId: string;
  sourceResponseId: string;
  showWhenDone: boolean;
  error: string;
  responseId?: string;
  controller?: AbortController | null;
  promise?: Promise<ExpansionValue | undefined> | null;
};
export type ExpansionChange = Omit<ExpansionState, "controller" | "promise">;
export type ExpansionOptions = {
  request: (
    path: string,
    method: string,
    body?: unknown,
    signal?: AbortSignal,
  ) => Promise<ExpansionValue>;
  onChange?: (state: ExpansionChange) => void;
  onReveal?: (
    response: ExpansionResponse,
    context: {
      sessionId: string;
      sourceResponseId: string;
      existing?: boolean;
    },
  ) => Promise<void>;
  pollMs?: number;
  timeoutMs?: number;
  maxEntries?: number;
};
export const expansionPath = (state: ExpansionState) =>
  `/sessions/${state.sessionId}/responses/${state.sourceResponseId}/tell-me-more`;
export function expansionDelay(signal: AbortSignal, milliseconds: number) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Interrupted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
