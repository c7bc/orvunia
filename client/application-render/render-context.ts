import type { ApplicationContext } from "../application/context.js";
export type RenderContext = Pick<ApplicationContext,
  | "state" | "environment" | "native" | "presentation" | "coding" | "audio"
  | "historyPager" | "markdown" | "modal" | "layout" | "navigation" | "connections"
  | "notes" | "prompt" | "historyDom" | "review" | "repository"
>;
