import { shell } from "./shell.js";
import { onboardContent } from "./content.js";
import { collectOnboarding, onboardingClick } from "./actions.js";
import type { OnboardingController } from "./controller-types.js";
export function renderOnboarding(controller: OnboardingController) {
  const { state, options, platform } = controller;
  const root = options.mount?.() ?? platform.document.querySelector<HTMLElement>("#app");
  if (!root || !state.visible || controller.lifetime.signal.aborted) return;
  collectOnboarding(controller, root);
  const view = { state: state.value, step: state.step, error: state.error, notice: "",
    busy: state.busy, demoAnswered: state.demoAnswered, locale: platform.locale(), shortcuts: options.shortcuts() };
  root.innerHTML = shell(view, onboardContent(view));
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select").forEach((element) => { element.disabled = state.busy; });
  platform.translate(root);
}
export function bindOnboarding(controller: OnboardingController) {
  const { document } = controller.platform;
  const run = (task: () => Promise<void>) => { void task().catch((error: unknown) => {
    if (controller.lifetime.signal.aborted) return;
    controller.state.error = error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.";
    controller.render();
  }); };
  const signal = controller.lifetime.signal;
  document.addEventListener("click", (event) => {
    if (controller.state.visible) run(() => onboardingClick(controller, event));
  }, { signal });
  document.addEventListener("submit", (event) => {
    const form = event.target as HTMLFormElement | null;
    if (!controller.state.visible || !form?.matches("[data-welcome-form=onboarding]")) return;
    event.preventDefault(); collectOnboarding(controller, form);
    run(() => controller.state.step === 6 ? controller.run(() => controller.complete()) : controller.next());
  }, { signal });
  document.addEventListener("change", (event) => {
    const field = event.target as HTMLSelectElement | null;
    if (controller.state.visible && field?.matches("[data-ui-locale]")) {
      controller.platform.setLocale(field.value); controller.render();
    }
  }, { signal });
}
