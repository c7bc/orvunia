import type {
  BrowserContext,
  BrowserPorts,
  LiveController,
} from "./contracts.js";
import type { WorkspaceController, WorkspaceState } from "./workspace-types.js";
export interface CompatibilityPlatform {
  window: Window;
  document: Document;
  api: BrowserPorts["api"];
  live(): LiveController;
  markdown: BrowserPorts["markdown"];
  sanitize: BrowserPorts["sanitize"];
  randomUUID(): string;
  abortController(): AbortController;
}
export interface CompatibilityApplication {
  state: WorkspaceState;
  controller: WorkspaceController;
  connect(audio: BrowserPorts["audio"]): BrowserContext;
  mount(): void;
  dispose(): void;
}
export interface CompatibilityGlobals {
  CadenceApi: BrowserPorts["api"];
  CadenceAudio: new () => BrowserPorts["audio"];
  CadenceCompatibility?: CompatibilityApplication;
  Live?: LiveController;
  marked: { parse(value: string): string };
  DOMPurify: { sanitize: BrowserPorts["sanitize"] };
}
declare global {
  interface Window extends CompatibilityGlobals {}
}
