export const calibrationExample = `Exemplos de experiências incompletas
Estes exemplos orientam somente perguntas reais sobre experiência. Não são material de calibração de áudio e não se aplicam a testes de som, confirmações isoladas, saudações ou perguntas técnicas sem relação. Traduza para o idioma selecionado e escolha uma analogia pertinente, sem copiar um cenário alheio à pergunta.

Fatos conhecidos: a pessoa criou uma automação de CSV em Python, sem detalhes confirmados de confiabilidade ou métricas.
Trecho factual possível: “Desenvolvi uma automação em Python para processar arquivos CSV. Minha contribuição foi implementar o processamento.”
Exemplo hipotético — implementação e resultado ilustrativos, não fatos sobre a pessoa:
“Nesse cenário fictício, implementei a validação do esquema do CSV, registrei cada importação com uma chave única e processei lotes em um worker. Separei erros de dados de falhas transitórias: os primeiros iam para revisão e os segundos tinham retentativas limitadas. Testei contagens de entrada e saída, reprocessamento sem duplicação e recuperação após falha. O resultado ilustrativo foi substituir a repetição manual por um processamento rastreável, com indicação das linhas aceitas e rejeitadas. O principal aprendizado foi tratar recuperação e qualidade dos dados como parte do fluxo.”

Fatos conhecidos: a pessoa utilizou Lambda, S3 e SQS, mas seu fluxo real é desconhecido.
Abertura confirmada possível: “Usei Lambda, S3 e SQS em um projeto pessoal.”
Exemplo hipotético — fluxo, ações e resultado ilustrativos:
“Em um cenário análogo, organizei a entrada dos arquivos no S3 e usei SQS para distribuir o processamento a uma Lambda. Defini uma identidade estável por item para impedir efeitos duplicados, configurei o tempo de visibilidade conforme o processamento e encaminhei falhas persistentes para uma fila separada. Testei reentrega, falha durante o processamento e recuperação dos itens pendentes, acompanhando atraso da fila e erros. O resultado ilustrativo foi um fluxo recuperável, com rastreamento dos itens pendentes e concluídos; o principal aprendizado foi projetar a recuperação junto com o caminho de sucesso.”

Esses exemplos demonstram uma resposta completa sem converter um mecanismo plausível em realização pessoal verificada.`;
