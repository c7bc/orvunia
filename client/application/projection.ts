import type { ApplicationContext } from "./context.js";
type Base = Pick<
  ApplicationContext,
  | "state"
  | "environment"
  | "native"
  | "request"
  | "audio"
  | "historyPager"
  | "historyDom"
  | "reviewHistoryDom"
>;
type Features = Omit<ApplicationContext, keyof Base>;
type Factories = { [Key in keyof Features]: () => Features[Key] };
export function projectApplicationContext(
  base: Base,
  factories: Factories,
): ApplicationContext {
  return {
    ...base,
    get presentation() {
      return factories.presentation();
    },
    get navigation() {
      return factories.navigation();
    },
    get markdown() {
      return factories.markdown();
    },
    get layout() {
      return factories.layout();
    },
    get modal() {
      return factories.modal();
    },
    get coding() {
      return factories.coding();
    },
    get answer() {
      return factories.answer();
    },
    get repository() { return factories.repository(); },
    get connections() {
      return factories.connections();
    },
    get modes() {
      return factories.modes();
    },
    get dialogs() {
      return factories.dialogs();
    },
    get microphone() {
      return factories.microphone();
    },
    get audioFeature() {
      return factories.audioFeature();
    },
    get uploads() {
      return factories.uploads();
    },
    get captures() {
      return factories.captures();
    },
    get notes() {
      return factories.notes();
    },
    get prompt() {
      return factories.prompt();
    },
    get lifecycle() {
      return factories.lifecycle();
    },
    get titles() {
      return factories.titles();
    },
    get shutdown() {
      return factories.shutdown();
    },
    get references() {
      return factories.references();
    },
    get followup() {
      return factories.followup();
    },
    get history() {
      return factories.history();
    },
    get commandSearch() {
      return factories.commandSearch();
    },
    get search() {
      return factories.search();
    },
    get exporter() {
      return factories.exporter();
    },
    get importCalendar() {
      return factories.importCalendar();
    },
    get rendering() {
      return factories.rendering();
    },
    get commands() {
      return factories.commands();
    },
    get synchronization() {
      return factories.synchronization();
    },
    get startup() {
      return factories.startup();
    },
    get review() {
      return factories.review();
    },
    get sessions() {
      return factories.sessions();
    },
    get storage() {
      return factories.storage();
    },
    get transcripts() {
      return factories.transcripts();
    },
    get filteredSessions() {
      return factories.filteredSessions();
    },
  };
}
