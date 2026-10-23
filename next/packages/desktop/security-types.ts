export type NativeFrame = { url: string };
export type NativeSecurityContents = {
  mainFrame: NativeFrame;
  getURL(): string;
  isDestroyed(): boolean;
};
export type NativeInvocation = {
  sender: NativeSecurityContents;
  senderFrame: NativeFrame | null;
};
type Preventable = { preventDefault(): void };
export interface NativeNavigationContents {
  setWindowOpenHandler(handler: () => { action: "deny" }): void;
  on(
    event: "will-navigate" | "will-redirect",
    listener: (request: Preventable, url: string) => void,
  ): void;
  on(
    event: "will-frame-navigate",
    listener: (request: Preventable & { url: string }) => void,
  ): void;
}
export type NativeDisplayRequest = {
  frame: NativeFrame | null;
  securityOrigin: string;
};
export interface NativePermissionSession<Source> {
  setPermissionCheckHandler(
    handler: (
      contents: NativeSecurityContents | null,
      permission: string,
      origin: string,
      details?: { isMainFrame?: boolean },
    ) => boolean,
  ): void;
  setPermissionRequestHandler(
    handler: (
      contents: NativeSecurityContents | null,
      permission: string,
      callback: (allowed: boolean) => void,
      details?: { isMainFrame?: boolean },
    ) => void,
  ): void;
  setDisplayMediaRequestHandler(
    handler: (
      request: NativeDisplayRequest,
      callback: (streams: { video?: Source; audio?: "loopback" }) => void,
    ) => Promise<void>,
  ): void;
}
