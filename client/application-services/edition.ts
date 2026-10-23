import type { OnboardingState } from "../onboarding/contracts.js";
export type WelcomeOptions = {
  mount?(): HTMLElement | null;
  toast(message: string): void;
  shortcuts(): Record<string, string | undefined>;
  onReady(state?: OnboardingState): void | Promise<void>;
  onProviders(render: () => void): void | Promise<void>;
  onNavigate(): void;
};
export type WelcomePort = {
  gate(options?: { forceOnboarding?: boolean }): Promise<boolean>;
  render(): void; openOnboarding(): Promise<boolean>; dispose(): void;
  readonly visible: boolean;
  readonly deployment: { mode: string };
  readonly account?: { user: { id?: string; name: string; email: string; image?: string | null } } | null;
  accountView?(section: string): Promise<string>;
  bindAccount?(root: HTMLElement, render: () => void): (() => void) | undefined;
};
export type UsageOptions = {
  document: Document; workspace(): string;
  api(path: string, method?: string, body?: unknown): Promise<unknown>;
  identifier(): string; navigate(url: string): void | Promise<void>;
  toast(message: string): void; onChange(): void;
};
export type UsagePort = {
  refresh(): Promise<void>; clear(): void; render(): string; dispose(): void;
};
export type ApplicationEdition = {
  welcome(options: WelcomeOptions): WelcomePort;
  billing?(options: UsageOptions): UsagePort;
  usageView(): string;
  settings?(options: { request(path: string, method?: string, body?: unknown): Promise<unknown>;
    changed(): void; toast(message: string): void; workspace(): string }): SettingsPort;
};
export type SettingsPort = { render(): string; bind(root: Document | HTMLElement): void; dispose(): void };
