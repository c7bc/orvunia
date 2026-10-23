import type { ApplicationRenderPorts, RenderCleanup } from "./contracts.js";

export function createApplicationRenderer(ports: ApplicationRenderPorts) {
  const document = ports.document;
  let account: RenderCleanup = null,
    calendar: RenderCleanup = null,
    gaze: RenderCleanup = null;
  let disposed = false;
  const query = <Element extends HTMLElement>(selector: string) =>
    document.querySelector<Element>(selector);
  function mount() {
    const root = query("#app");
    if (!root) throw Error("Application render mount is missing");
    return root;
  }
  function release() {
    account?.();
    calendar?.();
    gaze?.();
    account = calendar = gaze = null;
  }
  function render() {
    if (disposed) return;
    if (
      ports.prepared.get() &&
      ports.prepared.get()!.sessionId !== ports.read().currentId
    )
      ports.prepared.cancel();
    ports.notes()?.beforeRender?.();
    ports.prompt.beforeRender?.();
    ports.history.beforeRender(mount());
    const oldAnswer = query("#answer-area");
    const followAnswers =
      !oldAnswer ||
      oldAnswer.scrollHeight - oldAnswer.scrollTop - oldAnswer.clientHeight <
        90;
    const scrolls = ["#answer-area", ".session-detail-scroll"].map(
      (selector) => {
        const area = query(selector),
          owner = area?.querySelector("[data-history-list]");
        return {
          selector,
          key: owner?.getAttribute("data-history-list"),
          page: owner?.getAttribute("data-history-page"),
          top: area?.scrollTop || 0,
        };
      },
    );
    const editingTitle = document.activeElement?.matches?.(
      "input[data-session-title]",
    )
      ? (document.activeElement as HTMLInputElement)
      : null;
    const editingQuestion =
      document.activeElement?.id === "detail-question"
        ? (document.activeElement as HTMLTextAreaElement)
        : null;
    const motionHost = ports.motionTarget()?.isConnected
      ? ports.motionTarget()
      : null;
    const closingMenu =
      ports.read().view === "overlay" && !ports.read().overlayMore
        ? query("#app .overlay-menu")
        : null;
    const closingRectangle = closingMenu?.getBoundingClientRect();
    const closingStyle = closingMenu
      ? {
          opacity: ports.style(closingMenu).opacity,
          transform: ports.style(closingMenu).transform,
        }
      : null;
    release();
    ports.theme();
    if (ports.welcomeVisible()) {
      ports.welcomeRender();
      return;
    }
    ports.rememberNavigation();
    mount().innerHTML =
      ports.read().view === "control"
        ? ports.controlView()
        : ports.read().view === "overlay"
          ? ports.overlayView()
          : ports.panelView();
    if (motionHost) {
      const fresh =
        ports.read().view === "control"
          ? query(".control-shell")
          : ports.read().view === "overlay"
            ? query(".assistant")
            : null;
      if (fresh) {
        motionHost.className = fresh.className;
        motionHost.replaceChildren(...fresh.childNodes);
        fresh.replaceWith(motionHost);
      }
    }
    if (editingTitle) {
      const replacement = [
        ...document.querySelectorAll<HTMLInputElement>(
          "input[data-session-title]",
        ),
      ].find((field) => field.dataset.session === editingTitle.dataset.session);
      if (replacement) {
        replacement.replaceWith(editingTitle);
        editingTitle.focus({ preventScroll: true });
      }
    }
    const detailQuestion = query<HTMLTextAreaElement>("#detail-question"),
      sessionId = ports.read().currentId;
    if (detailQuestion && sessionId) {
      detailQuestion.dataset.session = sessionId;
      detailQuestion.value = ports.detailDraft(sessionId);
      if (editingQuestion?.dataset.session === sessionId) {
        detailQuestion.replaceWith(editingQuestion);
        editingQuestion.focus({ preventScroll: true });
      }
    }
    if (
      closingMenu &&
      !query("#app .overlay-menu") &&
      closingRectangle &&
      closingStyle
    )
      ports.retainMenu(closingMenu, closingRectangle, closingStyle);
    ports.notes()?.afterRender?.();
    ports.prompt.afterRender?.();
    ports.history.afterRender(mount());
    for (const saved of scrolls) {
      const area = query(saved.selector),
        owner = area?.querySelector("[data-history-list]");
      if (
        area &&
        owner &&
        owner.getAttribute("data-history-list") === saved.key &&
        owner.getAttribute("data-history-page") === saved.page
      )
        area.scrollTop = saved.top;
    }
    ports.decorateMarkdown();
    ports.translate(mount());
    ports.autosizeQuestion();
    if (
      ports.read().view === "overlay" &&
      ports.read().tab === "answers" &&
      followAnswers &&
      ports.read().currentId &&
      ports.followingLatest()
    )
      ports.scrollAnswers();
    ports.updateOverlaySize();
    ports.bindProviders();
    ports.schedule(() => {
      const question = query<HTMLTextAreaElement>("#detail-question"),
        send = query<HTMLButtonElement>('[data-action="review-ask"]');
      if (question && send)
        send.disabled = ports.read().busy || !question.value.trim();
    });
    calendar = ports.bindCalendar(mount());
    gaze = ports.bindGaze(mount());
    ports.animateAssistant();
    ports.updateReviewChat();
    ports.reapplyPreparedReveal();
    if (
      ports.read().page === "settings" &&
      ["profile", "security"].includes(ports.read().settingsTab) &&
      ports.cloudAccount()
    ) {
      void ports.loadAccount();
      const root = query(".welcome-account");
      if (root)
        account = ports.bindAccount(root, async () => {
          const section = ports.read().settingsTab;
          const markup = await ports.accountView(section);
          if (disposed) return;
          ports.accountMarkup(section, markup);
          render();
        });
    }
  }
  return {
    render,
    dispose() {
      disposed = true;
      release();
    },
  };
}
