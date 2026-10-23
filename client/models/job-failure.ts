import { t } from "@cadence/i18n";

export function modelDownloadFailure(code: string) {
  if (code === "model_retired")
    return t("Este modelo foi retirado da oferta. Novos downloads, importações e retomadas estão indisponíveis.");
  return t(code === "download_stalled"
    ? "O download parou de receber dados. Retome quando a conexão voltar."
    : "O download não foi concluído. Verifique a conexão e o espaço livre.");
}
