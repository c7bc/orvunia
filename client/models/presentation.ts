export const modelBytes = (value: number) => `${(value / 1024 ** 3).toFixed(2)} GB`;
export const modelVerdicts: Record<string, string> = {
  recommended: "Recomendado", "may-be-slow": "Pode ficar lento",
  incompatible: "Incompatível", "not-verified": "Ainda não validado",
};
export const modelStates: Record<string, string> = {
  queued: "Na fila", downloading: "Baixando", verifying: "Verificando arquivos",
  installed: "Instalado", cancelled: "Cancelado", failed: "Falha no download",
};
