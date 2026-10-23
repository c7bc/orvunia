export type RenderSnapshot = {
  currentId: string | undefined;
  view: string;
  page: string;
  settingsTab: string;
  tab: string;
  overlayMore: boolean;
  busy: boolean;
};
export type RenderCleanup = (() => void) | null | undefined;
export type RenderHooks = { beforeRender?(): unknown; afterRender?(): unknown };
export type RenderHistory = {
  beforeRender(root: Element): unknown;
  afterRender(root: Element): unknown;
};
export type ApplicationRenderPorts = {
  document: Document;
  read(): RenderSnapshot;
  prepared: { get(): { sessionId: string } | null; cancel(): unknown };
  notes(): RenderHooks | null | undefined;
  prompt: RenderHooks;
  history: RenderHistory;
  motionTarget(): HTMLElement | null;
  style(
    element: HTMLElement,
  ): Pick<CSSStyleDeclaration, "opacity" | "transform">;
  retainMenu(
    menu: HTMLElement,
    rectangle: DOMRect,
    style: Pick<CSSStyleDeclaration, "opacity" | "transform">,
  ): void;
  theme(): void;
  welcomeVisible(): boolean;
  welcomeRender(): void;
  rememberNavigation(): void;
  controlView(): string;
  overlayView(): string;
  panelView(): string;
  detailDraft(sessionId: string): string;
  decorateMarkdown(): void;
  translate(root: HTMLElement | null): void;
  autosizeQuestion(): void;
  followingLatest(): boolean;
  scrollAnswers(): void;
  updateOverlaySize(): void;
  bindProviders(): void;
  schedule(callback: () => void): void;
  bindCalendar(root: HTMLElement): RenderCleanup;
  bindGaze(root: HTMLElement): RenderCleanup;
  animateAssistant(): void;
  updateReviewChat(): void;
  reapplyPreparedReveal(): void;
  cloudAccount(): boolean;
  loadAccount(): unknown;
  accountView(section: string): Promise<string>;
  accountMarkup(section: string, markup: string): void;
  bindAccount(root: HTMLElement, render: () => Promise<void>): RenderCleanup;
};
