import {
  applicationHealth,
  applicationProviders,
} from "../application/decoders.js";
import type { ConnectionPorts } from "./contracts.js";
export function createApplicationConnections(ports: ConnectionPorts) {
  const { state, factories } = ports;
  let disposed = false;
  const gaze = factories.gaze({
    ...(ports.native ? { native: ports.native } : {}),
    toast: ports.toast,
    onRendered: ports.translateUI,
    onState() {
      const mount = ports.document.querySelector("#gaze-settings-mount");
      if (mount) mount.innerHTML = gaze.renderSettings();
    },
  });
  const welcome = factories.welcome({
    toast: ports.toast,
    shortcuts: () =>
      Object.fromEntries(
        Object.entries(state.desktop.settings.shortcuts).map(
          ([name, value]) => [
            name,
            (value ?? "")
              .replaceAll("CommandOrControl", "Ctrl")
              .replaceAll("+", " + ")
              .replaceAll("Space", "Espaço"),
          ],
        ),
      ),
    async onReady(onboarding) {
      if (onboarding) {
        await ports.sync();
        state.prefs = {
          ...state.prefs,
          output: onboarding.output,
          code: onboarding.code,
        };
        await ports.request("/preferences", "PUT", state.prefs);
        const preferred = state.modes.find(
          (mode) => mode.base === onboarding.mode && mode.builtin,
        );
        if (preferred)
          await ports.request(`/modes/${preferred.id}/activate`, "POST", {});
      }
      await ports.initialize();
    },
    async onProviders() {
      const workspace = state.workspaceKey;
      const providers = applicationProviders(await ports.request("/providers"));
      if (disposed || state.workspaceKey !== workspace) return;
      state.providerState = providers;
      const show = () => {
        ports.modal(
          "Conexões de IA",
          (welcome.deployment.mode === "cloud" ? ports.managed : ports.advanced)?.render() || ports.renderProviders(state.providerState!),
          "provider-onboarding-dialog",
        );
        bindProviders(show);
      };
      show();
    },
    onNavigate() {
      state.page = "home";
      ports.render();
    },
  });
  const navigate = async (url: string) => {
    if (ports.native?.openExternal) await ports.native.openExternal(url);
    else ports.navigate(url);
  };
  const billing = factories.billing?.({
    api: ports.request,
    toast: ports.toast,
    document: ports.document,
    workspace: () => state.workspaceKey,
    identifier: ports.identifier,
    onChange: ports.render,
    navigate,
  }) ?? null;
  const calendar = factories.calendar({
    api: ports.request,
    toast: ports.toast,
    onChange: ports.render,
    onOpenURL: navigate,
    onStart: async (event) => {
      await ports.begin(state.selectedMode, event.title);
    },
  });
  const accountScope = () =>
    JSON.stringify([
      state.workspaceKey,
      welcome.account?.user.id ?? welcome.account?.user.email ?? "",
    ]);
  let loadedAccountScope = accountScope();
  function bindProviders(onRefresh = ports.render) {
    const settings = welcome.deployment.mode === "cloud" ? ports.managed : ports.advanced;
    if (settings?.render()) { settings.bind(ports.document); return; }
    if (disposed || !state.providerState) return;
    const workspace = state.workspaceKey;
    ports.bindProviders({
      state: state.providerState,
      api: ports.request,
      toast: ports.toast,
      root: ports.document,
      async onSaved(value) {
        if (disposed || state.workspaceKey !== workspace) return;
        state.providerState = value;
        const health = applicationHealth(await ports.request("/health"));
        if (disposed || state.workspaceKey !== workspace) return;
        state.health = health;
        onRefresh();
      },
    });
  }
  async function loadAccountPanel() {
    if (disposed) return;
    const key = state.settingsTab,
      scope = accountScope();
    if (scope !== loadedAccountScope) {
      loadedAccountScope = scope;
      state.accountMarkup = {};
      state.accountLoading = new Set();
    }
    if (
      disposed ||
      state.page !== "settings" ||
      welcome.deployment.mode !== "cloud" ||
      !["profile", "security"].includes(key) ||
      state.accountMarkup[key] ||
      state.accountLoading.has(key)
    )
      return;
    const loading = state.accountLoading;
    loading.add(key);
    try {
      const markup = await welcome.accountView?.(key) ?? "";
      if (!disposed && accountScope() === scope)
        state.accountMarkup[key] = markup;
    } catch (error) {
      if (disposed || accountScope() !== scope) return;
      state.accountMarkup[key] =
        `<div class="account-load-error" role="alert"><p>${ports.escape(error instanceof Error ? error.message : String(error))}</p><button class="btn" data-action="account-retry">Tentar novamente</button></div>`;
    } finally {
      loading.delete(key);
      if (
        !disposed &&
        accountScope() === scope &&
        state.page === "settings" &&
        state.settingsTab === key
      )
        ports.render();
    }
  }
  return {
    gaze,
    welcome,
    billing,
    calendar,
    bindProviders,
    loadAccountPanel,
    renderBilling: () => billing?.render() ?? factories.usageView(),
    renderProviders: () => (welcome.deployment.mode === "cloud" ? ports.managed : ports.advanced)?.render() ||
      (state.providerState ? ports.renderProviders(state.providerState) : ""),
    dispose() {
      if (disposed) return;
      disposed = true;
      welcome.dispose();
      billing?.dispose();
      ports.advanced?.dispose(); ports.managed?.dispose();
    },
  };
}
