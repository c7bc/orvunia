import { isDesktopDocument, matchesOrigin } from "./origin.ts";
import type {
  NativeInvocation,
  NativeNavigationContents,
  NativeSecurityContents,
} from "./security-types.ts";

export function validateNativeInvocation(
  value: NativeInvocation,
  origin: string,
  contents: readonly NativeSecurityContents[],
) {
  if (
    !contents.includes(value.sender) ||
    value.sender.isDestroyed() ||
    !value.senderFrame ||
    value.senderFrame !== value.sender.mainFrame ||
    !isDesktopDocument(value.senderFrame.url, origin) ||
    !isDesktopDocument(value.sender.getURL(), origin)
  )
    throw Error("Origem inválida.");
}
export function secureNativeNavigation(
  contents: NativeNavigationContents,
  origin: () => string,
) {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  for (const name of ["will-navigate", "will-redirect"] as const)
    contents.on(name, (request, url) => {
      if (!matchesOrigin(url, origin())) request.preventDefault();
    });
  contents.on("will-frame-navigate", (request) => {
    if (!matchesOrigin(request.url, origin())) request.preventDefault();
  });
}
export function requestNativeDocument(
  ports: {
    contents: NativeSecurityContents & {
      session: { fetch(url: string, options: RequestInit): Promise<Response> };
    };
    trusted(): readonly NativeSecurityContents[];
    origin(): string;
    token(): string | null;
    fetch(url: string, options: RequestInit): Promise<Response>;
  },
  route: string,
  options: RequestInit,
) {
  const origin = ports.origin();
  if (
    !ports.trusted().includes(ports.contents) ||
    ports.contents.isDestroyed() ||
    !isDesktopDocument(ports.contents.getURL(), origin)
  )
    throw Error("Origem inválida.");
  if (route !== "/api/import" && route !== "/api/bootstrap?compact=1")
    throw Error("Rota de documento inválida.");
  const headers = new Headers(options.headers);
  headers.set("Origin", origin);
  const token = ports.token();
  if (token) headers.set("Authorization", "Bearer " + token);
  return token
    ? ports.fetch(origin + route, { ...options, headers })
    : ports.contents.session.fetch(origin + route, { ...options, headers });
}
