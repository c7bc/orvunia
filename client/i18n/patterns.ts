type Translation = (source: unknown) => string;
export function dynamicEnglish(source: string, translate: Translation) {
  const patterns: [RegExp, (match: RegExpMatchArray) => string][] = [
    [
      /^Configuração nativa inválida: (.+)$/,
      ([, field]) => `Invalid desktop setting: ${field}`,
    ],
    [
      /^Anexando capturas: (\d+)\/(\d+)$/,
      ([, count, total]) => `Attaching screenshots: ${count}/${total}`,
    ],
    [
      /^Você está usando o Orvunia (\d+\.\d+\.\d+(?:[-+][\w.-]+)?)$/,
      ([, version]) => `You are currently using Orvunia version ${version}`,
    ],
    [/^Opções da sessão (.+)$/, ([, title]) => `Options for ${title}`],
    [/^Título da seção (\d+)$/, ([, number]) => `Section ${number} title`],
    [
      /^Instruções da seção (\d+)$/,
      ([, number]) => `Section ${number} instructions`,
    ],
    [
      /^(\d+) modelos disponíveis\. Digite ou escolha um no campo Modelo\.$/,
      ([, number]) =>
        `${number} models available. Type or select one in the Model field.`,
    ],
    [
      /^(\d+) referências?$/,
      ([, number]) => `${number} reference${number === "1" ? "" : "s"}`,
    ],
    [
      /^(\d+) capturas? no contexto$/,
      ([, number]) =>
        `${number} screenshot${number === "1" ? "" : "s"} in context`,
    ],
    [
      /^Ponto (\d+) de (\d+) · (.+)$/,
      ([, number, total, status]) =>
        `Point ${number} of ${total} · ${translate(status)}`,
    ],
    [
      /^Coletando (\d+)\/(\d+)$/,
      ([, number, total]) => `Collecting ${number}/${total}`,
    ],
    [/^Digite (.+) para confirmar$/, ([, email]) => `Type ${email} to confirm`],
    [/^Conectada em (.+)$/, ([, date]) => `Connected on ${date}`],
    [/^Última atualização: (.+)$/, ([, date]) => `Last active: ${date}`],
    [
      /^Etapa (\d+) de (\d+)$/,
      ([, number, total]) => `Step ${number} of ${total}`,
    ],
    [/^([\d.,]+) caracteres$/, ([, number]) => `${number} characters`],
    [/^Última sincronização: (.+)$/, ([, date]) => `Last synced: ${date}`],
    [
      /^(.+) reservado em solicitações em andamento\.$/,
      ([, number]) => `${number} reserved for requests in progress.`,
    ],
    [
      /^(.+) de transcrição por mês$/,
      ([, number]) => `${number} of transcription per month`,
    ],
    [
      /^Os limites renovam em (.+), às 00:00 UTC\. O saldo considera as solicitações em andamento\.$/,
      ([, date]) =>
        `Limits reset on ${date} at 00:00 UTC. Requests in progress are included in your balance.`,
    ],
    [
      /^([\d.,]+)% — o texto permanece opaco e nítido\.$/,
      ([, number]) => `${number}% — text stays opaque and sharp.`,
    ],
  ];
  for (const [expression, format] of patterns) {
    const match = source.match(expression);
    if (match) return format(match);
  }
  return source;
}
