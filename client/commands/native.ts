import type { CommandDesktop } from "./model.js";
export interface CommandNative {
  overlay(): Promise<unknown>;
  panel(page: string): Promise<unknown>;
  toggle(): Promise<unknown>;
  hide(): Promise<unknown>;
  minimize(): Promise<unknown>;
  maximize(): Promise<unknown>;
  quit(): Promise<unknown>;
  end(): Promise<unknown>;
  position(mode: string): Promise<unknown>;
  clipboard(): Promise<string>;
  copy?(text: string): Promise<unknown>;
  chatVisibility?(visible: boolean): Promise<CommandDesktop>;
  shortcutReset(name: string): Promise<CommandDesktop>;
  openUpdate(url: string): Promise<unknown>;
  openWindowsManagement?(action: "startup" | "updates"): Promise<unknown>;
  source(id: string): Promise<unknown>;
}
