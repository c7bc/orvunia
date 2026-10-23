import { currentLocale, setLocale, translateUI } from "@cadence/i18n";
import { installPanelSelects } from "../select/index.js";
import { onboardingResponse } from "./validation.js";
import { bindOnboarding, renderOnboarding } from "./render.js";
import { createOnboardingProgress } from "./actions.js";
import type { WelcomeOptions, WelcomePort } from "../application-services/edition.js";
import type { OnboardingController, OnboardingPlatform } from "./controller-types.js";
export function createPersonalWelcome(options: WelcomeOptions, platform: OnboardingPlatform = browserPlatform()): WelcomePort {
  const lifetime = new AbortController();
  const state: OnboardingController["state"] = { value: null, step: 0, visible: false,
    busy: false, error: "", demoAnswered: false, generation: 0 };
  const controller: OnboardingController = {
    options, platform, lifetime, state, render: () => renderOnboarding(controller),
    async run(task) {
      if (state.busy || lifetime.signal.aborted) return;
      state.busy = true; state.error = ""; controller.render();
      try { await task(); }
      catch (error) {
        if (!lifetime.signal.aborted) state.error = error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.";
      } finally { state.busy = false; controller.render(); }
    },
    next: () => progress.next(), complete: (skipped) => progress.complete(skipped),
  };
  const progress = createOnboardingProgress(controller);
  const disposeSelects = installPanelSelects(platform.document, { selector: ".welcome-shell select",
    popupClassName: "welcome-select-popup", motion: "clerk" });
  bindOnboarding(controller);
  async function gate({ forceOnboarding = false } = {}) {
    const generation = ++state.generation;
    const result = await platform.request("/onboarding", "GET", undefined, lifetime.signal);
    lifetime.signal.throwIfAborted();
    if (generation !== state.generation) return state.visible;
    state.value = onboardingResponse(result);
    state.visible = !state.value.completed || forceOnboarding;
    if (state.visible) { state.step = 0; state.error = ""; controller.render(); }
    return state.visible;
  }
  return { gate, render: controller.render, openOnboarding: () => gate({ forceOnboarding: true }),
    get visible() { return state.visible; }, deployment: { mode: "local" },
    dispose() { state.generation++; lifetime.abort(); disposeSelects(); } };
}
function browserPlatform(): OnboardingPlatform {
  return { document, locale: currentLocale, setLocale, translate: translateUI,
    async request(path, method = "GET", body, signal) {
      const response = await fetch(`/api${path}`, { method, credentials: "same-origin",
        ...(signal ? { signal } : {}), headers: { "X-Cadence-Request": "1", "Accept-Language": currentLocale(),
          ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const value: unknown = await response.json();
      if (!response.ok) throw Error("Não foi possível concluir. Tente novamente.");
      return value;
    } };
}
