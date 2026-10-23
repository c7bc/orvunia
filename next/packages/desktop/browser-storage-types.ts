export type BrowserStorageEntries = readonly (readonly [string, string])[];
export interface BrowserStoragePort {
  read(origin: string): Promise<unknown>;
  replace(origin: string, entries: BrowserStorageEntries): Promise<void>;
  close(): void;
}
export interface BrowserStorageWindow {
  loadURL(url: string): Promise<void>;
  destroy(): void;
  webContents: {
    session: object;
    getURL(): string;
    executeJavaScript(script: string): Promise<unknown>;
  };
}
export interface BrowserStorageSession {
  flushStorageData(): void;
  protocol: {
    isProtocolHandled(scheme: string): Promise<boolean>;
    handle(scheme: string, handler: (request: Request) => Response): void;
    unhandle(scheme: string): void;
  };
}
