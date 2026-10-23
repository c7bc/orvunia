import type { ApplicationState } from "../application/model.js";
import type { createMicrophoneTest } from "../microphone/controller.js";
import { createMicrophoneDevices } from "./microphone-devices.js";
import { createSystemAudioDevices } from "./system-audio-devices.js";
import type {
  ApplicationButton,
  ApplicationModal,
  ApplicationTranslate,
} from "./contracts.js";
export function createApplicationMicrophone(ports: {
  state: ApplicationState;
  document: Document;
  enumerate(): Promise<MediaDeviceInfo[]>;
  systemAudioDevices?: () => Promise<unknown>;
  observe?(refresh: (force?: boolean) => void): () => void;
  create: typeof createMicrophoneTest;
  modal: ApplicationModal;
  button: ApplicationButton;
  escape(value: unknown): string;
  translate: ApplicationTranslate;
  toast(message: string): void;
}) {
  const { document, state } = ports;
  const system = createSystemAudioDevices({ ...ports, ...(ports.systemAudioDevices ? { list: ports.systemAudioDevices } : {}),
    selected: () => state.desktop.settings.systemAudioDevice || "default:multimedia" });
  const devices = createMicrophoneDevices({ ...ports,
    ...(ports.observe ? { observe: (refresh: (force?: boolean) => void) => ports.observe!(force => { refresh(force); system.refresh(force); }) } : {}),
    selected: () => state.desktop.settings.microphone || "default" });
  function meter(level: number) {
    const element = document.querySelector<HTMLElement>(".microphone-meter");
    if (!element) return;
    const percent = Math.round(Math.min(1, level * 4) * 100);
    element.setAttribute("aria-valuenow", String(percent));
    const bar = element.firstElementChild as HTMLElement | null;
    if (bar) bar.style.width = `${percent}%`;
  }
  return {
    loadDevices: async () => { await Promise.all([devices.load(), system.load()]); },
    watch() { const stop = devices.watch(); system.refresh(); return () => { stop(); system.dispose(); }; },
    open() {
      ports.modal(
        "Testar microfone",
        `<p class="notice microphone-test-notice">Teste local do microfone — não transcreve nem salva falas.</p><p>Ouça sua voz pelo indicador. O teste dura até 12 segundos, usa apenas este dispositivo e não grava nem envia áudio.</p><div class="microphone-meter" role="meter" aria-label="Nível do microfone" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div><p class="microphone-test-state" role="status">Clique em Iniciar teste para permitir o microfone.</p><div class="form-footer">${ports.button("Iniciar teste", "microphone-test-start", "primary")}${ports.button("Parar", "microphone-test-stop")}</div>`,
        "microphone-test-dialog",
      );
      state.microphoneTest = ports.create({
        onLevel: meter,
        onState(snapshot) {
          if (snapshot.status === "listening") void devices.load();
          const status = document.querySelector(".microphone-test-state");
          if (status)
            status.textContent = ports.translate(
              {
                idle: "Clique em Iniciar teste para permitir o microfone.",
                requesting: "Aguardando permissão do microfone…",
                listening: "Fale normalmente para conferir o nível.",
                stopped:
                  snapshot.reason === "timeout"
                    ? "Teste concluído. O microfone foi desligado."
                    : "Microfone desligado.",
                error:
                  "Não foi possível testar o microfone. Confira a permissão e o dispositivo.",
              }[snapshot.status],
            );
          const start = document.querySelector<HTMLButtonElement>(
            '[data-action="microphone-test-start"]',
          );
          if (start)
            start.disabled = ["requesting", "listening"].includes(
              snapshot.status,
            );
          if (snapshot.status !== "listening") meter(0);
        },
        onError: (error) => ports.toast(error.message),
      });
    },
  };
}
