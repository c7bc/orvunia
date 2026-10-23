import type { CommandContext } from "./ports.js";
export async function runSystemCommands(
  context: CommandContext,
  key: string,
  value: string,
): Promise<boolean> {
  const { state: browser, ports } = context;
  switch (key) {
    case "account-signout":
      ports.gaze.stop();
      await ports.audio.stop();
      browser.controller?.abort();
      await ports.request("/auth/sign-out", "POST", {});
      ports.window.location.assign("/desktop.html");
      return true;
    case "chat-visibility":
      ports.preparedReveal.cancel();
      if (ports.native?.chatVisibility)
        browser.desktop = await ports.native.chatVisibility(
          !browser.desktop.overlayVisible,
        );
      else {
        browser.desktop.overlayVisible = !browser.desktop.overlayVisible;
        ports.broadcast({
          type: "visibility",
          visible: browser.desktop.overlayVisible,
        });
      }
      ports.render();
      return true;
    case "check-updates":
      await ports.checkUpdates();
      return true;
    case "onboarding":
      await ports.welcome.openOnboarding();
      return true;
    case "quit-app":
      if (ports.native) await ports.native.quit();
      else ports.toast("Feche esta aba para sair.");
      return true;
    case "export-data":
      await ports.downloadData();
      return true;
    case "workspace-delete":
      ports.modal(
        "Apagar os dados deste espaço",
        '<p>Isso apaga permanentemente o histórico, contexto, modos e a configuração inicial deste espaço local. Exporte seus dados antes de continuar. As conexões de IA do servidor serão mantidas.</p><form id="workspace-delete-form"><div class="field"><label>Digite EXCLUIR para confirmar<input name="confirmation" required pattern="EXCLUIR" autocomplete="off"></label></div><div class="form-footer"><button class="btn primary" type="submit">Apagar permanentemente</button></div></form>',
      );
      return true;
    case "calendar-import":
      ports.importCalendar();
      return true;
    case "modal-close":
      ports.closeModal();
      return true;
    case "hide-panel":
      ports.preparedReveal.cancel();
      if (ports.native) await ports.native.hide();
      return true;
    case "minimize":
      ports.preparedReveal.cancel();
      await ports.native?.minimize();
      return true;
    case "maximize":
      await ports.native?.maximize();
      return true;
    case "camera":
    case "cursor":
      if (ports.native) await ports.native.position(key);
      else ports.toast("Disponível no aplicativo para Windows.");
      return true;
    case "devices":
      await ports.loadDevices();
      return true;
    case "microphone-test":
      ports.openMicrophoneTest();
      return true;
    case "microphone-test-start":
      await ports.microphoneTest?.start(
        browser.desktop.settings.microphone || "default",
      );
      return true;
    case "microphone-test-stop":
      ports.microphoneTest?.stop();
      return true;
    case "schedule":
      ports.modal(
        "Agendar conversa",
        ports.renderScheduleForm(ports.panelState()),
      );
      return true;
    case "agenda-delete":
      browser.agenda = browser.agenda.filter((a) => a.id !== value);
      ports.saveAgenda();
      ports.render();
      return true;
  }
  return false;
}
