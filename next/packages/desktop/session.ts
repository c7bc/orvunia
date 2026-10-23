import { desktopHeaders } from "./headers.ts";
type RequestHeaders = Record<string, string>;
type HeaderListener = (
  request: {
    url: string;
    webContentsId?: number;
    requestHeaders: RequestHeaders;
  },
  callback: (result: { requestHeaders: RequestHeaders }) => void,
) => void;
export interface NativeSession {
  webRequest: {
    onBeforeSendHeaders(listener: HeaderListener | null): void;
  };
}
export interface NativeContents {
  id: number;
  isDestroyed(): boolean;
  getURL(): string;
}
export function privateDesktopSession(dependencies: {
  session: NativeSession;
  origin: string;
  token: string;
  contents(): readonly NativeContents[];
}) {
  let disposed = false;
  const headers = desktopHeaders({
    origin: dependencies.origin,
    token: dependencies.token,
    trusted(id) {
      if (disposed) return false;
      const contents = dependencies
        .contents()
        .find((value) => value.id === id && !value.isDestroyed());
      if (!contents) return false;
      try {
        const location = new URL(contents.getURL());
        return (
          location.origin === dependencies.origin &&
          location.pathname === "/desktop.html" &&
          !location.username &&
          !location.password
        );
      } catch {
        return false;
      }
    },
  });
  dependencies.session.webRequest.onBeforeSendHeaders((request, callback) => {
    try {
      callback(headers(request));
    } catch {
      const clean = { ...request.requestHeaders };
      for (const name of Object.keys(clean))
        if (
          name.toLowerCase() === "authorization" &&
          clean[name] === `Bearer ${dependencies.token}`
        )
          delete clean[name];
      callback({ requestHeaders: clean });
    }
  });
  return () => {
    if (disposed) return;
    disposed = true;
    dependencies.session.webRequest.onBeforeSendHeaders(null);
  };
}
