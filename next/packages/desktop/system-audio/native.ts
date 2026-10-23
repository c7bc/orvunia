import type { NativeContext } from "../application-types.ts";
import type { PlatformInvocation } from "../platform-types.ts";
import type { PlatformContents } from "../platform-window.ts";
import { validateNativeInvocation } from "../native-security.ts";
import { createSystemAudioManager } from "./manager.ts";
import { systemAudioRequest } from "./contracts.ts";
import { systemAudioHelper } from "./helper.ts";
import { enumerateSystemAudio } from "./enumerate.ts";
import { systemAudioDirectory, verifySystemAudioResources } from "./resources.ts";

export function createNativeSystemAudio(context: NativeContext, ports: {
  interactive(): void; contents(): readonly PlatformContents[];
}) {
  const owners = new Map<number, PlatformInvocation>();
  const directory = systemAudioDirectory(context.desktopDirectory, context.electron.app.isPackaged);
  const launch = systemAudioHelper(directory, context.process.env);
  const verify = () => verifySystemAudioResources(directory, context.abort.signal);
  const manager = createSystemAudioManager({
    supported: () => context.process.platform === "win32",
    allowed(owner) {
      const request = owners.get(owner.senderId);
      if (!request || context.active?.id !== owner.sessionId) return false;
      try { validateNativeInvocation(request, context.origin, ports.contents()); return true; } catch { return false; }
    },
    enumerate: async () => { await verify(); return enumerateSystemAudio(launch); },
    launch,
    event(owner, data) {
      const contents = owners.get(owner.senderId)?.sender;
      if (contents && !contents.isDestroyed()) contents.send("cadence:event", { type: "system-audio", data });
    },
  });
  context.abort.signal.addEventListener("abort", () => { void manager.stop().catch(() => {}); }, { once: true });
  return {
    async invoke(request: PlatformInvocation, value: unknown) {
      validateNativeInvocation(request, context.origin, ports.contents());
      const input = systemAudioRequest.parse(value);
      if (input.action === "start") {
        ports.interactive();
        if (context.process.platform === "win32") await verify();
        validateNativeInvocation(request, context.origin, ports.contents());
        owners.set(request.sender.id, request);
      }
      return manager.invoke(request.sender.id, input);
    },
    stop: manager.stop,
    async senderGone(senderId: number) { await manager.senderGone(senderId); owners.delete(senderId); },
  };
}
