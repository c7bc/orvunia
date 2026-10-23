export function listeningError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/^system_audio_[a-z_]+$/.test(message)) return message;
  if (["system_audio_endpoint_removed", "system_audio_no_endpoint", "system_audio_endpoint_unavailable", "system_audio_endpoint_not_found"].includes(message))
    return "A saída de áudio selecionada está indisponível. Escolha outro dispositivo em Geral.";
  if (message === "system_audio_backpressure")
    return "A captura do computador foi pausada porque a conexão não acompanhou o áudio.";
  if (message === "system_audio_disconnected")
    return "A conexão de transcrição foi encerrada. Inicie a escuta novamente.";
  if (message.includes("timeout"))
    return "A captura do computador demorou para responder. Tente iniciar a escuta novamente.";
  return "Não foi possível capturar o áudio deste dispositivo. Confira a saída selecionada em Geral.";
}
