import type { WelcomeOptions } from "../application-services/edition.js";
import type { OnboardingState } from "./contracts.js";
export type OnboardingPlatform = {
  document: Document;
  locale(): string;
  setLocale(value: string): unknown;
  translate(root: HTMLElement): void;
  request(path: string, method?: string, body?: unknown, signal?: AbortSignal): Promise<unknown>;
};
export type OnboardingController = {
  options: WelcomeOptions;
  platform: OnboardingPlatform;
  lifetime: AbortController;
  state: { value: OnboardingState | null; step: number; visible: boolean; busy: boolean;
    error: string; demoAnswered: boolean; generation: number };
  render(): void;
  run(task: () => Promise<void>): Promise<void>;
  next(): Promise<void>;
  complete(skipped?: boolean): Promise<void>;
};
