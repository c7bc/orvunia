import type {
  ExpansionOptions,
  ExpansionState,
  ExpansionValue,
} from "./expansion";
import { expansionDelay, expansionPath } from "./expansion";

type Dependencies = {
  request: ExpansionOptions["request"];
  apply(state: ExpansionState, value: ExpansionValue): void;
  reveal(state: ExpansionState, signal: AbortSignal): Promise<ExpansionValue>;
  onReveal: NonNullable<ExpansionOptions["onReveal"]>;
  emit(state: ExpansionState): void;
  isCurrent(): boolean;
  pollMs: number;
  timeoutMs: number;
};

export async function prepareExpansion(
  state: ExpansionState,
  controller: AbortController,
  show: boolean,
  dependencies: Dependencies,
) {
  const { request, apply, isCurrent } = dependencies;
  try {
    const current = await request(
      expansionPath(state),
      "GET",
      undefined,
      controller.signal,
    );
    if (!isCurrent()) return;
    apply(state, current);
    if (current.status === "revealed") {
      if (show && current.response)
        await dependencies.onReveal(current.response, {
          sessionId: state.sessionId,
          sourceResponseId: state.sourceResponseId,
          existing: true,
        });
      return current;
    }
    if (current.status === "expired")
      throw Object.assign(
        Error(
          "O contexto original expirou ou não está mais disponível. Faça uma nova pergunta com o contexto atual.",
        ),
        { status: 410 },
      );
    let value = current;
    if (!["ready", "generating"].includes(current.status)) {
      state.requestId ||= crypto.randomUUID();
      state.status = "generating";
      state.error = "";
      dependencies.emit(state);
      value = await request(
        expansionPath(state),
        "POST",
        {
          requestId: state.requestId,
          consent: true,
        },
        controller.signal,
      );
      if (!isCurrent()) return;
      apply(state, value);
    }
    const deadline = Date.now() + dependencies.timeoutMs;
    while (value.status === "generating") {
      if (Date.now() >= deadline)
        throw Error(
          "O aprofundamento demorou para ficar pronto. Tente novamente.",
        );
      await expansionDelay(controller.signal, dependencies.pollMs);
      value = await request(
        expansionPath(state),
        "GET",
        undefined,
        controller.signal,
      );
      if (!isCurrent()) return;
      apply(state, value);
    }
    if (value.status !== "ready" && value.status !== "revealed")
      throw Object.assign(
        Error(value.message || "Não foi possível preparar o aprofundamento."),
        { status: value.status === "expired" ? 410 : undefined },
      );
    if (state.showWhenDone)
      return dependencies.reveal(state, controller.signal);
    return value;
  } catch (error) {
    if (isCurrent()) {
      const failure =
        error instanceof Error
          ? error
          : Error("Não foi possível preparar o aprofundamento.");
      state.status =
        "status" in failure && failure.status === 410 ? "expired" : "failed";
      state.error =
        failure.name === "AbortError"
          ? "Preparação interrompida."
          : failure.message;
      state.showWhenDone = false;
      dependencies.emit(state);
    }
    throw error;
  }
}
