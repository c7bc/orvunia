import { join } from "node:path";
import { desktopBackend } from "./host.ts";
import type { BackendState } from "./supervisor.ts";
import type { NativeSession, NativeContents } from "./session.ts";
import type { SecretVault } from "../providers/domain.ts";
import type { RuntimeIdentity } from "./runtime-profile.ts";
import { loadRuntimeRelease } from "./release-loader.ts";
import { startOnDesktopPort } from "./port-recovery.ts";
import { legacyDesktopOwner } from "./legacy-owner.ts";
import type { LegacyCookies } from "./legacy-types.ts";
import { desktopEnvironment } from "./environment.ts";
export async function startCandidateBackend(options: {
  directory: string;
  profile: string;
  identity: RuntimeIdentity;
  session: NativeSession;
  contents(): readonly NativeContents[];
  onState(state: BackendState): void;
  vault: SecretVault | null;
  signal: AbortSignal;
  cookies?: Pick<LegacyCookies, "get">;
  configuration?: {
    root: string;
    environment: Record<string, string | undefined>;
  };
}) {
  const resources = await loadRuntimeRelease(options.directory, options.signal);
  const environment = options.configuration
    ? await desktopEnvironment({
        ...options.configuration,
        dataDirectory: join(options.profile, "data"),
        signal: options.signal,
        onExternalUnavailable: () =>
          console.warn("External provider configuration is unavailable."),
      })
    : {};
  return startOnDesktopPort({
    signal: options.signal,
    start: async (port) => {
      const origin = `http://127.0.0.1:${port}`;
      const selected = options.cookies
        ? await legacyDesktopOwner(
            options.cookies,
            join(options.profile, "data"),
            origin,
          )
        : undefined;
      options.signal.throwIfAborted();
      const host = desktopBackend({
        session: options.session,
        contents: options.contents,
        onState: options.onState,
        launch: {
          executable: resources.executable,
          checksum: resources.release.executableSha256,
          entrypoint: resources.entrypoint,
          directory: resources.directory,
          port,
          startupMs: 120000,
          ...(options.vault ? { vault: options.vault } : {}),
          environment: {
            ...environment,
            ...(resources.modelRuntimeDirectory ? { ORVUNIA_MODEL_RUNTIME_DIRECTORY: resources.modelRuntimeDirectory } : {}),
            ...(process.env.SystemRoot
              ? { SystemRoot: process.env.SystemRoot }
              : {}),
            CADENCE_DEPLOYMENT: "local",
            CADENCE_DESKTOP_PROFILE: options.profile,
            CADENCE_DESKTOP_MIGRATION: "quiesced",
            ...(selected ? { CADENCE_LEGACY_WORKSPACE: selected } : {}),
            PORT: String(port),
            CADENCE_LOCAL_TOKEN: options.identity.token,
            CADENCE_LOCAL_WORKSPACE: options.identity.workspaceId,
            CADENCE_SQLITE_PATH: join(
              options.profile,
              "data/cadence-next.sqlite",
            ),
            CADENCE_CLIENT_DIRECTORY: resources.clientDirectory,
            CADENCE_PUBLIC_URL: origin,
          },
        },
      });
      const cancel = () => {
        void host.stop().catch(() => {});
      };
      options.signal.addEventListener("abort", cancel, { once: true });
      try {
        await host.start();
        options.signal.throwIfAborted();
        return { host, origin, vaultProtection: options.vault ? "os" : "file" };
      } catch (error) {
        await host.stop();
        throw error;
      } finally {
        options.signal.removeEventListener("abort", cancel);
      }
    },
  });
}
