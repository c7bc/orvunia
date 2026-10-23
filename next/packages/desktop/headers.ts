type NativeRequest = {
  url: string;
  webContentsId?: number;
  requestHeaders: Record<string, string>;
};
export function desktopHeaders(dependencies: {
  origin: string;
  token: string;
  trusted(webContentsId: number): boolean;
}) {
  const expected = new URL(dependencies.origin).origin,
    authorization = `Bearer ${dependencies.token}`;
  if (!expected.startsWith("http://127.0.0.1:"))
    throw Error("Private desktop headers require a loopback backend");
  return (request: NativeRequest) => {
    const headers = { ...request.requestHeaders };
    for (const key of Object.keys(headers))
      if (
        key.toLowerCase() === "authorization" &&
        headers[key] === authorization
      )
        delete headers[key];
    const target = new URL(request.url);
    if (target.protocol === "ws:") target.protocol = "http:";
    if (
      target.origin === expected &&
      request.webContentsId !== undefined &&
      dependencies.trusted(request.webContentsId)
    ) {
      for (const key of Object.keys(headers))
        if (key.toLowerCase() === "authorization") delete headers[key];
      headers.Authorization = authorization;
    }
    return { requestHeaders: headers };
  };
}
