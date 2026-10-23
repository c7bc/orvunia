import { createCodingWorkspace } from "../coding/workspace.js";
import { createStreamRenderer } from "../coding/paint.js";
import { createPreparedReveal } from "../coding/reveal.js";
import { createTellMoreController } from "../coding/controller.js";
import { createApplicationCodingViews } from "./coding-views.js";
import type { ExpansionValue } from "../coding/expansion.js";
import type { ApplicationRequest } from "./request.js";
import { record, text } from "../legacy-web/validation.js";

function expansion(value: unknown): ExpansionValue {
  const item = record(value),
    status = item.status;
  if (
    status !== "absent" &&
    status !== "generating" &&
    status !== "ready" &&
    status !== "revealed" &&
    status !== "expired" &&
    status !== "failed"
  )
    throw Error("Aprofundamento inválido do servidor.");
  const response =
    item.response === undefined ? undefined : record(item.response);
  return {
    ...item,
    status,
    ...(response === undefined
      ? {}
      : {
          response: {
            ...response,
            id: text(response.id),
            text: text(response.text),
          },
        }),
  };
}
type ViewPorts = Omit<
  Parameters<typeof createApplicationCodingViews>[0],
  "coding" | "tellMore" | "prepared"
>;
export function createApplicationCoding(
  ports: ViewPorts & {
    request: ApplicationRequest;
    render(): void;
    sync(): Promise<unknown>;
    reducedMotion(): boolean;
  },
) {
  const { state } = ports,
    coding = createCodingWorkspace();
  const paint = createStreamRenderer((text) => views.paint(text));
  const prepared = createPreparedReveal({
    reducedMotion: ports.reducedMotion,
    isCurrent: (frame) =>
      state.current?.id === frame.sessionId &&
      coding.generation === frame.generation,
    onFrame(frame) {
      state.preparedRevealFrame = frame;
      paint.push(frame.visibleText);
      if (frame.done || frame.visibleText.length <= 32000) paint.flush();
    },
  });
  const tellMore = createTellMoreController({
    request: async (...args) => expansion(await ports.request(...args)),
    onChange: (value) => views.refresh(value),
    async onReveal(response, { sessionId, existing }) {
      if (state.current?.id !== sessionId) return;
      const generation = coding.generation;
      await ports.sync();
      if (state.current?.id !== sessionId || coding.generation !== generation)
        return;
      prepared.cancel();
      ports.render();
      if (!existing)
        prepared.start({
          sessionId,
          responseId: response.id,
          text: response.text,
          generation,
        });
      const escaped = ports.escapeSelector(response.id);
      ports.document
        .querySelector(
          `[data-markdown="${escaped}"],[data-session-response="${escaped}"]`,
        )
        ?.scrollIntoView({
          block: "nearest",
          behavior: ports.reducedMotion() ? "instant" : "smooth",
        });
    },
  });
  const views = createApplicationCodingViews({
    ...ports,
    coding,
    tellMore,
    prepared,
  });
  return {
    coding,
    prepared,
    tellMore,
    paint,
    views,
    dispose() {
      coding.dispose();
      prepared.dispose();
      paint.cancel();
      tellMore.dispose();
    },
  };
}
