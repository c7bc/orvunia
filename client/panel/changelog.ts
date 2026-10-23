import type { PanelState } from "./state.js";

export function changelog(s: PanelState) {
  const version = [
      "4.9.0",
      "4.8.0",
      "4.7.1",
      "4.7.0",
      "4.6.0",
      "4.5.0",
      "4.4.0",
      "4.3.1",
      "4.3.0",
      "4.2.0",
      "4.1.0",
      "4.0.0",
      "3.1.0",
    ].includes(s.releaseVersion ?? "")
      ? s.releaseVersion
      : "4.9.0",
    previous = version === "3.1.0",
    visualMotion = version === "4.9.0",
    continuity = version === "4.8.0",
    uiPatch = version === "4.7.1",
    paging = version === "4.7.0",
    polish = version === "4.6.0",
    sessions = version === "4.5.0",
    technical = version === "4.4.0",
    patch = version === "4.3.1",
    latest = version === "4.3.0",
    components = version === "4.2.0",
    current =
      visualMotion ||
      continuity ||
      uiPatch ||
      paging ||
      polish ||
      sessions ||
      technical ||
      patch ||
      latest ||
      components ||
      version === "4.1.0";
  const title = visualMotion
    ? "Conversas com mais clareza."
    : continuity
      ? "Continue de onde parou."
      : uiPatch
        ? "Detalhes que fazem diferença."
        : paging
          ? "Sua história, sempre por perto."
          : polish
            ? "Sua conversa, do começo ao fim."
            : sessions
              ? "Uma conversa que permanece sua."
              : technical
                ? "Seu código e sua conta, conectados."
                : patch
                  ? "Sua conta, mais clara."
                  : latest
                    ? "Movimento natural. Mais autonomia."
                    : components
                      ? "Cada componente, cada movimento."
                      : current
                        ? "Mais próximo em cada detalhe."
                        : previous
                          ? "O contexto certo em cada conversa."
                          : "Seu espaço, seus modelos.";
  return `<article class="release-document"><header class="release-meta"><span class="release-document-badge">Notas da versão ${version}</span><time datetime="2026-10-14" data-i18n-skip>${new Date(Date.UTC(2026, 9, 14)).toLocaleDateString(s.uiLocale || "pt-BR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })}</time><details class="release-version-menu"><summary>Todas as versões</summary><div><button data-release-version="4.9.0">4.9.0 · Conversas e transições</button><button data-release-version="4.8.0">4.8.0 · Continuidade e movimento</button><button data-release-version="4.7.1">4.7.1 · Ajustes de interface</button><button data-release-version="4.7.0">4.7.0 · Histórico completo</button><button data-release-version="4.6.0">4.6.0 · Notas, conversa e contas</button><button data-release-version="4.5.0">4.5.0 · Sessões e continuidade</button><button data-release-version="4.4.0">4.4.0 · Código, conta e componentes</button><button data-release-version="4.3.1">4.3.1 · Perfil e segurança</button><button data-release-version="4.3.0">4.3.0 · Movimento e autonomia</button><button data-release-version="4.2.0">4.2.0 · Componentes e movimento</button><button data-release-version="4.1.0">4.1.0 · Interface e integrações</button><button data-release-version="4.0.0">4.0.0 · Local e cloud</button><button data-release-version="3.1.0">3.1.0 · Fluxos de reunião</button></div></details></header><h1>${title}</h1><p class="release-intro">${current ? "O painel, os modos e a página de sessão seguem uma hierarquia visual consistente, com as ferramentas disponíveis no ponto certo da conversa." : previous ? "Notas por seções, navegação por teclado e uma página de sessão para rever e continuar suas conversas." : "Orvunia reúne o assistente de conversas e as ferramentas de entrevista técnica em uma instalação local aberta, com uma base separada para hospedagem cloud."}</p><div class="release-body">${visualMotion ? `<h2>Mensagens no mesmo ritmo</h2><p>Perguntas, respostas e indicadores de atividade seguem as medidas da referência, com o histórico e a seleção preservados.</p><h2>Conta sem saltos</h2><p>Abrir e fechar um editor movimenta também as seções ao redor. Campos removidos não ficam interativos durante a transição.</p><h2>Diálogos que terminam o movimento</h2><p>A saída mantém o tamanho e a opacidade visíveis, inclusive ao interromper uma entrada. Trocas rápidas e movimento reduzido encerram as camadas anteriores.</p>` : continuity ? `<h2>Histórico sem perder o ponto</h2><p>Navegue por respostas e falas anteriores em páginas menores. A chegada de conteúdo novo preserva a página e a seleção que você está lendo.</p><h2>Seu modo, seu rascunho</h2><p>A formatação marca as alterações e pode ser desfeita após uma atualização da tela. Modos personalizados também estão disponíveis no agendamento.</p><h2>Movimento e espaço</h2><p>O menu acompanha a altura da pergunta. Os controles de recolher e o brilho da transcrição seguem os valores observados na referência e respeitam movimento reduzido.</p>` : uiPatch ? `<h2>Controles consistentes</h2><p>Os seletores da página inicial e do agendamento seguem o mesmo componente do painel. O microfone tem alinhamento e foco mais claros.</p><h2>Mais espaço e legibilidade</h2><p>Os campos de agendamento e a página de plano têm mais respiro. As instruções da agenda respeitam o tema e a conexão usa o símbolo do Google.</p><h2>Seções em movimento</h2><p>As opções de agenda e idioma abrem e fecham suavemente, respeitando a preferência de movimento reduzido.</p>` : paging ? `<h2>Histórico sob demanda</h2><p>Carregue respostas, falas e capturas anteriores quando precisar, mantendo as conversas completas salvas.</p><h2>Encontre o que ficou para trás</h2><p>A busca percorre o conteúdo salvo. Cópias e exportações incluem todo o histórico, mesmo quando parte dele ainda não foi aberta na tela.</p>` : polish ? `<h2>Edite as notas do seu jeito</h2><p>Use seleção, formatação e desfazer no editor visual. O Markdown continua preservado no salvamento e na exportação.</p><h2>Converse sobre a sessão</h2><p>Abra a conversa em uma janela dedicada, com as respostas e o contexto da reunião. O rodapé acompanha a presença de uma sessão ativa.</p><h2>Saiba quando há fala</h2><p>Os indicadores de voz e de transcrição usam os sinais recebidos do áudio e respeitam a preferência de movimento reduzido.</p><h2>Contexto para continuar</h2><p>Revise respostas complementares e novas capturas antes de enviá-las, mantendo os dados de cada sessão separados.</p><h2>Melhorias nas contas cloud</h2><p>Os recursos de conta continuam vinculados à configuração e à identidade autenticada do serviço.</p>` : sessions ? `<h2>Notas que acompanham sua conversa</h2><p>Edite o título e as notas na sessão. O salvamento automático preserva suas alterações e permite resolver conflitos entre janelas.</p><h2>Continue com o contexto certo</h2><p>Repetir um pedido preparado usa seu contexto original. Capturas novas entram somente quando você as escolhe, sem duplicar um envio repetido.</p><h2>Conclua a fala antes de responder</h2><p>O assistente aguarda a confirmação da transcrição antes de preparar uma resposta. Uma demora ou falha mantém a solicitação disponível para tentar novamente.</p><h2>Detalhes em movimento</h2><p>Abas, rodapé, histórico e busca receberam ajustes de apresentação, teclado e animação.</p>` : technical ? `<h2>Prepare sua solução</h2><p>Edite enunciado e código por sessão, organize até três capturas pendentes e peça ajuda sobre uma resposta selecionada.</p><h2>Continue depois de uma interrupção</h2><p>Preserve o texto parcial e repita a solicitação original sem misturar sessões.</p><h2>Gerencie seus emails</h2><p>Adicione e verifique endereços, escolha o principal e gerencie os demais na sua conta cloud.</p><h2>Menus e movimento</h2><p>Ícones, temas e menus com navegação por teclado, fechamento animado e suporte a movimento reduzido.</p>` : patch ? `<h2>Perfil e segurança</h2><p>Avatar, ações, editores e dispositivos com uma apresentação mais consistente.</p><h2>Menus que acompanham sua navegação</h2><p>Os menus de conta se fecham ao clicar ou mover o foco para fora. Falhas ao carregar a conta podem ser tentadas novamente.</p>` : latest ? `<h2>Transições mais naturais</h2><ul><li>Indicadores e controles acompanham suas ações com movimentos suaves.</li><li>O editor anterior se desfoca e desaparece durante a troca de modos.</li><li>Trocas rápidas, cancelamentos e movimento reduzido mantêm a interface estável.</li></ul><h2>Controles compartilhados</h2><p>Navegue pelos seletores de configurações, introdução e conta com o teclado.</p><h2>Mais controle depois da conversa</h2><ul><li>Revise o email de acompanhamento e confirme antes de enviar por uma conexão SMTP configurada.</li><li>Repetir a mesma confirmação não duplica o envio.</li><li>Use a ferramenta offline para exportar e restaurar backups locais.</li></ul><p>As integrações disponíveis respeitam a configuração de cada instalação.</p>` : components ? `<h2>Componentes mais consistentes</h2><ul><li>Configurações, menus, modelos e busca com espaçamentos e estados compartilhados.</li><li>O modo Geral apresenta o contexto automático e mantém sua personalização disponível.</li><li>Nomes personalizados permanecem intactos ao trocar o idioma do aplicativo.</li></ul><h2>Movimento com intenção</h2><p>Menus, janelas e editores ganham transições sem reanimar atualizações de dados. A preferência de movimento reduzido do sistema é respeitada.</p><h2>Depois da conversa</h2><p>Revise e copie um email de acompanhamento a partir do resumo da sessão. Atualizações e integrações dependem da configuração de cada instalação.</p>` : current ? `<h2>Uma interface mais clara</h2><ul><li>Configurações com dimensões, espaçamentos e controles alinhados em todas as seções.</li><li>Catálogo de modelos integrado ao editor de modos, com seleção e ativação independentes.</li><li>Prompt, arquivos e notas na mesma sequência, preservando as ações de entrevista técnica.</li><li>Sessões com abas compactas, ações de resumo e a conversa no rodapé.</li></ul><h2>Integrações no aplicativo</h2><p>A conexão com Google Calendar usa o navegador externo e retorna à instalação local por uma autorização de uso único. Login Google no desktop depende da ponte de autenticação configurada; nenhum contorno do navegador é usado.</p><h2>Seu ambiente continua seu</h2><p>Provedores de IA, armazenamento local, controles de captura, edição cloud e calibração experimental pelo olhar continuam disponíveis. A validação com webcam e chamadas reais permanece separada dos testes de interface.</p>` : previous ? `<h2>Uma conversa que continua</h2><ul><li>Organize suas notas em seções com títulos e orientações próprias.</li><li>Pesquise suas reuniões e configurações com Ctrl+K.</li><li>Consulte resumo, transcrição e uso, faça perguntas e retome uma sessão preservando o histórico.</li><li>Use quatro ações no popup e abra o menu Smart para os controles da sessão.</li></ul>` : `<h2>Escolha como usar</h2><ul><li>Na instalação local, use sem conta e conecte seus próprios modelos de resposta e transcrição.</li><li>Na edição cloud, mantenha contas, histórico isolado, limites e cobrança administrados pelo serviço.</li><li>Crie modos com prompts, referências e modelos de notas próprios.</li></ul><h2>Mais controle durante a conversa</h2><p>O popup reúne ações de entrevista, contexto da tela e transcrição. O posicionamento pelo olhar é experimental, exige ativação explícita e calibração local em nove pontos. A validação com webcam real ainda está pendente.</p><h2>Provedores e integrações</h2><p>Os adaptadores incluem OpenAI, Anthropic, Gemini, Groq, OpenRouter, Ollama, Deepgram, AssemblyAI e APIs compatíveis, conforme a função. Email, Google Calendar e cobrança dependem da configuração do administrador.</p>`}</div><footer>Orvunia · Código aberto e implementação independente.</footer></article>`;
}
