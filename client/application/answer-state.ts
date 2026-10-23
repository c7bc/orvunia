import type { ApplicationState } from "./model.js";
import type { AnswerState } from "../answers/contracts.js";
export function projectAnswerState(
  state: ApplicationState,
  native: boolean,
): AnswerState {
  return {
    get view() {
      return state.view;
    },
    get current() {
      return state.current;
    },
    get selectedMode() {
      return state.selectedMode;
    },
    get settings() {
      return state.desktop.settings;
    },
    native,
    get source() {
      return state.source;
    },
    get ambientStarting() {
      return state.ambientStarting;
    },
    set ambientStarting(value) {
      state.ambientStarting = value;
    },
    get reviewChatSessionId() {
      return state.reviewChatSessionId;
    },
    get codeLanguage() {
      return state.prefs.code;
    },
    get chatCollapsed() {
      return state.chatCollapsed;
    },
    set chatCollapsed(value) {
      state.chatCollapsed = value;
    },
    get busy() {
      return state.busy;
    },
    set busy(value) {
      state.busy = value;
    },
    get controller() {
      return state.controller;
    },
    set controller(value) {
      state.controller = value;
    },
    get draft() {
      return state.draft;
    },
    set draft(value) {
      state.draft = value;
    },
    get liveText() {
      return state.liveText;
    },
    set liveText(value) {
      state.liveText = value;
    },
    get liveQuestion() {
      return state.liveQuestion;
    },
    set liveQuestion(value) {
      state.liveQuestion = value;
    },
    get tab() {
      return state.tab;
    },
    set tab(value) {
      state.tab = value;
    },
    get activeAnswerRequest() {
      return state.activeAnswerRequest;
    },
    set activeAnswerRequest(value) {
      state.activeAnswerRequest = value;
    },
    get answerPhase() {
      return state.answerPhase;
    },
    set answerPhase(value) {
      state.answerPhase = value;
    },
  };
}
