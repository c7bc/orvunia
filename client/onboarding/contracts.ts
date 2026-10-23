export type Onboarding = {
  persona: string; industry: string; discovery: string; goal: string;
  experience: string; mode: "recruiter" | "technical"; output: string; code: string;
};
export type OnboardingState = Onboarding & {
  version: 1; completed: boolean; skipped: boolean; tutorialComplete: boolean;
};
export type OnboardingView = {
  state: Onboarding | null; step: number; error: string; notice: string;
  busy: boolean; demoAnswered: boolean; locale: string;
  shortcuts: Record<string, string | undefined>;
  setup?: { heading: string; description: string; fields: string };
  footer?: string; authenticationBrand?: string;
};
