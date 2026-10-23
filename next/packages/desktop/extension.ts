import type { NativeContext } from "./application-types.ts";
import type { PlatformInvocation } from "./platform-types.ts";
export type NativeExtension = {
  snapshot(): Record<string, unknown>;
  handlers: Record<string, (request: PlatformInvocation, value: unknown) => unknown>;
  stop(): unknown | Promise<unknown>;
};
export type NativeExtensionFactory = (
  context: NativeContext, interactive: () => void,
) => NativeExtension;
