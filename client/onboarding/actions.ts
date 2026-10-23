import type { OnboardingController } from "./controller-types.js";
import { finalOnboardingStep } from "./primitives.js";
export function collectOnboarding(controller: OnboardingController, root: HTMLElement) {
  const value = controller.state.value;
  if (!value) return;
  for (const key of ["goal", "experience", "output", "code"] as const) {
    const input = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${key}"]`);
    if (input) value[key] = input.value;
  }
}
export async function onboardingClick(controller: OnboardingController, event: MouseEvent) {
  const target = event.target as Element | null;
  const button = target?.closest<HTMLElement>("[data-welcome],[data-welcome-choice]");
  if (!button || controller.state.busy) return;
  collectOnboarding(controller, controller.options.mount?.() ?? controller.platform.document.body);
  const choice = button.dataset.welcomeChoice;
  if (choice && controller.state.value) {
    const [field, value] = choice.split(":");
    if (!value) return;
    if (field === "mode" && (value === "technical" || value === "recruiter")) controller.state.value.mode = value;
    else if (field === "persona" || field === "industry" || field === "discovery") controller.state.value[field] = value;
    if (field === "persona") await controller.next();
    else controller.render();
    return;
  }
  switch (button.dataset.welcome) {
    case "next": await controller.next(); break;
    case "back": controller.state.step = Math.max(0, controller.state.step - 1); controller.render(); break;
    case "skip": await controller.run(() => controller.complete(true)); break;
    case "providers": await controller.options.onProviders(controller.render); break;
    case "demo-ask": controller.state.demoAnswered = true; controller.render(); break;
  }
}
export function createOnboardingProgress(controller: OnboardingController) {
  return {
    async next() {
      await controller.run(async () => {
        if (controller.state.step === finalOnboardingStep) return controller.complete(true);
        if (!controller.state.value) return;
        await controller.platform.request("/onboarding", "PUT", controller.state.value, controller.lifetime.signal);
        controller.lifetime.signal.throwIfAborted();
        controller.state.step++; controller.state.demoAnswered = false;
      });
    },
    async complete(skipped = false) {
      if (!controller.state.value) return;
      const value = { ...controller.state.value, completed: true, skipped,
        tutorialComplete: !skipped && controller.state.step === finalOnboardingStep };
      await controller.platform.request("/onboarding", "PUT", value, controller.lifetime.signal);
      controller.lifetime.signal.throwIfAborted();
      controller.state.value = value; controller.state.visible = false;
      await controller.options.onReady(value);
    },
  };
}
