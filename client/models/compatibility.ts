import { t } from "@cadence/i18n";

const labels: Record<string, string> = {
  "context-too-large": "O contexto solicitado excede o limite deste modelo.",
  "capability-unavailable": "Este modelo não oferece a função selecionada.",
  "disk-insufficient": "Não há espaço livre suficiente para baixar e verificar os arquivos.",
  "unknown-memory": "Não foi possível medir a memória disponível.",
  "ram-insufficient": "Não há memória disponível suficiente no momento.",
  "simultaneous-load": "A memória disponível não comporta estes modelos ao mesmo tempo.",
  "backend-unavailable": "Este tipo de processador não é compatível com o modelo.",
  "cpu-fallback": "Usa o processador do computador; as respostas podem demorar mais.",
  "unknown-disk": "Não foi possível medir o espaço livre em disco.",
  "model-not-verified": "O desempenho deste modelo ainda não foi validado nesta máquina.",
  "runtime-unavailable": "O componente necessário para executar este modelo não está disponível.",
  "runtime-unsupported": "O componente de execução não é compatível com este modelo.",
};

export function compatibilityReason(code: string) {
  const normalized = code.replaceAll("_", "-");
  return t(Object.hasOwn(labels, normalized) ? labels[normalized] : "A compatibilidade desta condição ainda não foi confirmada.");
}
