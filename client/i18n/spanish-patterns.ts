type Translation = (source: unknown) => string;
export function dynamicSpanish(source: string, translate: Translation) {
  const patterns: [RegExp, (match: RegExpMatchArray) => string][] = [
    [
      /^Configuração nativa inválida: (.+)$/,
      ([, field]) => `Configuración nativa inválida: ${field}`,
    ],
    [
      /^Anexando capturas: (\d+)\/(\d+)$/,
      ([, count, total]) => `Adjuntando capturas: ${count}/${total}`,
    ],
    [
      /^Você está usando o Orvunia (\d+\.\d+\.\d+(?:[-+][\w.-]+)?)$/,
      ([, version]) => `Estás usando la versión ${version} de Orvunia`,
    ],
    [/^Opções da sessão (.+)$/, ([, title]) => `Opciones de ${title}`],
    [
      /^Título da seção (\d+)$/,
      ([, number]) => `Título de la sección ${number}`,
    ],
    [
      /^Instruções da seção (\d+)$/,
      ([, number]) => `Instrucciones de la sección ${number}`,
    ],
    [
      /^(\d+) modelos disponíveis\. Digite ou escolha um no campo Modelo\.$/,
      ([, number]) =>
        `${number} modelos disponibles. Escribe o elige uno en el campo Modelo.`,
    ],
    [
      /^(\d+) referências?$/,
      ([, number]) => `${number} referencia${number === "1" ? "" : "s"}`,
    ],
    [
      /^(\d+) capturas? no contexto$/,
      ([, number]) =>
        `${number} captura${number === "1" ? "" : "s"} en el contexto`,
    ],
    [
      /^Ponto (\d+) de (\d+) · (.+)$/,
      ([, number, total, status]) =>
        `Punto ${number} de ${total} · ${translate(status)}`,
    ],
    [
      /^Coletando (\d+)\/(\d+)$/,
      ([, number, total]) => `Recogiendo ${number}/${total}`,
    ],
    [
      /^Digite (.+) para confirmar$/,
      ([, email]) => `Escribe ${email} para confirmar`,
    ],
    [/^Conectada em (.+)$/, ([, date]) => `Conectada el ${date}`],
    [/^Última atualização: (.+)$/, ([, date]) => `Última actividad: ${date}`],
    [
      /^Etapa (\d+) de (\d+)$/,
      ([, number, total]) => `Paso ${number} de ${total}`,
    ],
    [/^([\d.,]+) caracteres$/, ([, number]) => `${number} caracteres`],
    [
      /^Última sincronização: (.+)$/,
      ([, date]) => `Última sincronización: ${date}`,
    ],
    [
      /^(.+) reservado em solicitações em andamento\.$/,
      ([, number]) => `${number} reservado para solicitudes en curso.`,
    ],
    [
      /^(.+) de transcrição por mês$/,
      ([, number]) => `${number} de transcripción al mes`,
    ],
    [
      /^Os limites renovam em (.+), às 00:00 UTC\. O saldo considera as solicitações em andamento\.$/,
      ([, date]) =>
        `Los límites se renuevan el ${date} a las 00:00 UTC. El saldo incluye las solicitudes en curso.`,
    ],
    [
      /^([\d.,]+)% — o texto permanece opaco e nítido\.$/,
      ([, number]) => `${number}% — el texto sigue opaco y nítido.`,
    ],
  ];
  for (const [expression, format] of patterns) {
    const match = source.match(expression);
    if (match) return format(match);
  }
  return source;
}
