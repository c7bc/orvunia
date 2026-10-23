import { isDesktopDocument, matchesOrigin } from "./origin.ts";
import type {
  NativeSecurityContents,
  NativeDisplayRequest,
  NativePermissionSession,
} from "./security-types.ts";

export function configureNativePermissions<
  Source extends { id: string },
>(ports: {
  session: NativePermissionSession<Source>;
  enabled(): boolean;
  origin(): string;
  contents(): readonly NativeSecurityContents[];
  selected(): string | null;
  sources(): Promise<readonly Source[]>;
}) {
  const permissions = new Set(["media", "display-capture", "notifications"]);
  function trusted(contents: NativeSecurityContents | null) {
    try {
      return Boolean(
        ports.enabled() &&
        contents &&
        ports.contents().includes(contents) &&
        !contents.isDestroyed() &&
        isDesktopDocument(contents.getURL(), ports.origin()),
      );
    } catch {
      return false;
    }
  }
  function displayAllowed(request: NativeDisplayRequest, selected: string) {
    return Boolean(
      ports.enabled() &&
      ports.selected() === selected &&
      request.frame &&
      matchesOrigin(request.securityOrigin, ports.origin()) &&
      isDesktopDocument(request.frame.url, ports.origin()) &&
      ports
        .contents()
        .some(
          (contents) =>
            trusted(contents) && contents.mainFrame === request.frame,
        ),
    );
  }
  ports.session.setPermissionCheckHandler(
    (contents, permission, origin, details) =>
      trusted(contents) &&
      matchesOrigin(origin, ports.origin()) &&
      details?.isMainFrame !== false &&
      permissions.has(permission),
  );
  ports.session.setPermissionRequestHandler(
    (contents, permission, callback, details) =>
      callback(
        trusted(contents) &&
          details?.isMainFrame !== false &&
          permissions.has(permission),
      ),
  );
  ports.session.setDisplayMediaRequestHandler(async (request, callback) => {
    let response: { video?: Source; audio?: "loopback" } = {};
    try {
      const selected = ports.selected();
      if (selected && displayAllowed(request, selected)) {
        const sources = await ports.sources(),
          source = sources.find((candidate) => candidate.id === selected);
        if (source && displayAllowed(request, selected))
          response = { video: source, audio: "loopback" };
      }
    } catch {}
    try {
      callback(response);
    } catch {}
  });
}
