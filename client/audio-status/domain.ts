export type AudioPhase = "off" | "starting" | "selecting" | "listening" | "detected" | "transcribing" | "saved" | "error";
export const phaseLabels: Record<AudioPhase, string> = {
  off: "Escuta desligada — nenhuma nova fala sendo salva",
  starting: "Conectando a transcrição — ainda não está ouvindo",
  selecting: "Escolha a fonte de áudio para iniciar a escuta",
  listening: "Escuta ativa — aguardando fala",
  detected: "Voz detectada — aguardando transcrição",
  transcribing: "Transcrevendo — fala ainda não salva",
  saved: "Fala salva na transcrição",
  error: "Falha na transcrição — confira as falas salvas",
};
export const channelLabels: Record<AudioPhase, string> = {
  off: "Escuta desligada",
  starting: "Conectando transcrição",
  selecting: "Aguardando fonte de áudio",
  listening: "Escuta ativa",
  detected: "Som detectado",
  transcribing: "Transcrição pendente",
  saved: "Última fala salva",
  error: "Erro de transcrição",
};
export type AudioStatusContext = {
  current?: { id: string; state: string; transcripts: { id: string }[]; history?: { transcripts: { total: number } } } | null;
  audioProgress?: ReadonlyMap<string, AudioPhase>;
  desktop: { settings: { transcribeMicrophone?: boolean; systemAudio?: boolean } };
};
export function sessionAudioStatus(context: AudioStatusContext) {
  const session = context.current;
  const channels = ([
    ["microphone", "Sua voz", context.desktop.settings.transcribeMicrophone !== false],
    ["system", "Computador", context.desktop.settings.systemAudio === true],
  ] as const).map(([kind, label, enabled]) => ({
    kind, label, enabled,
    phase: (session?.state === "active" && enabled
      ? context.audioProgress?.get(`${session.id}:${kind}`) ?? "off"
      : "off") as AudioPhase,
  }));
  const priority: AudioPhase[] = ["error", "starting", "selecting", "transcribing", "detected", "saved", "listening"];
  const phase = priority.find(value => channels.some(channel => channel.phase === value)) ?? "off";
  return { phase, channels, saved: session?.history?.transcripts.total ?? session?.transcripts.length ?? 0 };
}
