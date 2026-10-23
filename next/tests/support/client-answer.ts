import { createCodingWorkspace } from "../../../client/coding/workspace.ts";
import type {
  AnswerContext,
  AnswerState,
} from "../../../client/answers/contracts.ts";
export function clientAnswer() {
  const state: AnswerState = {
    view: "overlay",
    current: {
      id: crypto.randomUUID(),
      mode: "technical",
      state: "active",
      transcripts: [],
      responses: [],
      captures: [],
    },
    selectedMode: "technical",
    settings: {},
    native: false,
    source: null,
    ambientStarting: null,
    reviewChatSessionId: null,
    codeLanguage: "TypeScript",
    chatCollapsed: false,
    busy: false,
    controller: null,
    draft: "Synthetic question",
    liveText: "",
    liveQuestion: "",
    tab: "answers",
    activeAnswerRequest: null,
    answerPhase: "",
  };
  const coding = createCodingWorkspace();
  const notices: string[] = [],
    sent: unknown[] = [];
  const context: AnswerContext = {
    state,
    coding,
    audio: { running: false, flush: async () => {} },
    tellMore: {
      stats: () => ({ active: 0 }),
      cancelActive: async () => {},
      prepare: async () => {},
    },
    question: () => undefined,
    focusQuestion() {},
    latest() {},
    identify: () => crypto.randomUUID(),
    begin: async () => {},
    modeName: (value) => value,
    broadcast() {},
    render() {},
    toast: (message) => notices.push(message),
    sync: async () => {},
    capture: async () => {
      throw Error("Unexpected capture");
    },
    session: async () => {
      throw Error("Unexpected session lookup");
    },
    upload: async () => {
      throw Error("Unexpected upload");
    },
    fetch: async (_url, options) => {
      sent.push(JSON.parse(String(options.body)));
      return new Response(
        'event: delta\ndata: {"text":"Synthetic answer"}\n\nevent: done\ndata: {"id":"saved"}\n\n',
      );
    },
    paint() {},
    progress() {},
    applyGenerated: async () => {},
    generatedFallback() {},
  };
  return { context, state, coding, notices, sent };
}
