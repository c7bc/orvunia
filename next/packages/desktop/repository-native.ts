import type { NativeContext } from "./application-types.ts";
import type { PlatformInvocation } from "./platform-types.ts";
import { createNativeRepositoryHandler } from "./repository-handlers.ts";
import { validateNativeInvocation } from "./native-security.ts";
import { nativeRepositoryRequest } from "./repository-request.ts";
import { createNativeRepositoryPreparation } from "./repository-preparation.ts";
import { nativeRepositoryLocations } from "./repository-locations.ts";
import { join } from "node:path";

export function nativeRepository(context: NativeContext, ports: {
  interactive(): void;
  contents(): readonly PlatformInvocation["sender"][];
}) {
  const windows = new Map<number, { request: PlatformInvocation;
    handler: ReturnType<typeof createNativeRepositoryHandler> }>();
  function validate(request: PlatformInvocation) {
    validateNativeInvocation(request, context.origin, ports.contents());
  }
  let preparation: ReturnType<typeof createNativeRepositoryPreparation> | null = null;
  function preparationHandler() {
    return preparation ??= createNativeRepositoryPreparation({
    interactive: ports.interactive, signal: context.abort.signal,
    locations: nativeRepositoryLocations(join(context.profile, "repository-locations.json"), () => context.origin),
    activeSession: () => context.active?.id ?? null,
    async identity(modeId, windowId) {
      const request = windows.get(Number(windowId))?.request;
      if (!request) throw Error("repository_identity_changed");
      return nativeRepositoryRequest(context, request, "/repository-preparation/modes/" + encodeURIComponent(modeId),
        context.abort.signal, () => validate(request));
    },
    async session(sessionId, windowId) {
      const request = windows.get(Number(windowId))?.request;
      if (!request) throw Error("repository_identity_changed");
      return nativeRepositoryRequest(context, request, "/repository-preparation/sessions/" + encodeURIComponent(sessionId),
        context.abort.signal, () => validate(request));
    },
    async choose(windowId) {
      const request = windows.get(Number(windowId))?.request;
      if (!request) throw Error("repository_identity_changed");
      validate(request);
      return context.electron.dialog.showOpenDialog(context.panel, { properties: ["openDirectory"], filters: [] });
    },
    });
  }
  function create(initial: PlatformInvocation) {
    const state = { request: initial };
    const handler = createNativeRepositoryHandler({
        interactive: ports.interactive,
        signal: context.abort.signal,
        activeSession: () => context.active?.id ?? null,
        prepared: (owner, modeId) => preparationHandler().selection(owner, modeId),
        choose: () => {
          const request = state.request;
          validate(request);
          return context.electron.dialog.showOpenDialog(context.panel,
            { properties: ["openDirectory"], filters: [] });
        },
        async binding(sessionId, signal) {
          const request = state.request;
          validate(request);
          return nativeRepositoryRequest(context, request, "/sessions/" + encodeURIComponent(sessionId)
            + "/repository-agent/binding", signal, () => validate(request));
        },
      });
    return Object.assign(state, { handler });
  }
  return {
    invoke(request: PlatformInvocation, value: unknown) {
      validate(request);
      let state = windows.get(request.sender.id);
      if (!state) { state = create(request); windows.set(request.sender.id, state); }
      state.request = request;
      if (value && typeof value === "object" && "preparation" in value)
        return preparationHandler().invoke(String(request.sender.id), value);
      return state.handler.invoke(String(request.sender.id), value);
    },
    close() {
      preparation?.close();
      preparation = null;
      for (const state of windows.values()) state.handler.close();
      windows.clear();
    },
  };
}
