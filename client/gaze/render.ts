import type { GazeState } from "./runtime";
import { escapeHtml } from "../design/html";
export function renderGazeSettings(
  state: GazeState,
  calibrating: boolean,
  nativeFollowing: boolean,
) {
  const labels = {
    off: "Desligado",
    loading: "Carregando modelo local",
    permission: "Aguardando permissão da câmera",
    calibrating: "Calibrando nove pontos",
    activating: "Ativando acompanhamento",
    tracking: "Acompanhando o olhar",
    preview: "Prévia no navegador",
    paused: "Pausado · olhos fora de vista",
    stopped: "Câmera desligada",
  };
  return `<section class="gaze-settings"><div class="gaze-setting-heading"><span class="gaze-eye-icon" aria-hidden="true">◉</span><div><h3>Acompanhar o olhar <small>Experimental</small></h3><p>Estima onde você olha usando as íris e a posição do rosto.</p></div><span class="gaze-state ${state.cameraActive ? "active" : ""}">${escapeHtml(labels[state.stage] || state.stage)}</span></div><p>Precisa de webcam, boa iluminação e calibração em nove pontos. Mantenha a cabeça estável; óculos, reflexos e movimentos podem reduzir a precisão. A calibração é temporária e deve ser repetida ao mudar de posição.</p><div class="gaze-buttons">${state.enabled ? `<button class="btn" data-gaze="stop">Desligar câmera</button>${state.cameraActive && !calibrating ? `<button class="btn" data-gaze="calibrate">Recalibrar</button>` : ""}` : `<button class="btn primary" data-gaze="start">Ativar e calibrar</button>`}</div>${state.error ? `<p class="gaze-error" role="alert">${escapeHtml(state.error)}</p>` : ""}${state.rmse !== null ? `<p class="gaze-caption">Erro observado na calibração: ${(state.rmse * 100).toFixed(1)}% da tela. Isso não garante a mesma precisão durante o uso.</p>` : ""}<p class="gaze-caption">Tudo é processado neste computador. Nenhum frame ou ponto facial é salvo ou enviado ao servidor. A câmera desliga ao cancelar, fechar ou perder os olhos por 15 segundos. ${nativeFollowing ? "O ponto estimado reposiciona o assistente dentro do monitor calibrado." : "No navegador há somente a estimativa; a janela não é movida."} Validação com webcam real ainda pendente.</p></section>`;
}
