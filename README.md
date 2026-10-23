# Orvunia

Instalação pessoal, sem conta obrigatória, PostgreSQL ou Redis. O histórico e as
conexões ficam no perfil local; a instalação não envia histórico ao Orvunia Cloud.

Requer Bun 1.4.3. Execute `bun install --frozen-lockfile`, `bun run build`
e `bun start`. Acesse a origem loopback indicada no console. Configure suas
conexões de texto, visão e transcrição na interface. Os testes locais usam
fixtures sintéticas: `bun run check` e `bun test`.

`bun run test` executa somente testes unitários e de integração. Os ensaios
locais em `next/tests/e2e/` e seus helpers públicos também fazem parte dos
fontes, com ativação explícita pelas variáveis declaradas em cada arquivo.
Eles exigem runtimes verificados e fixtures próprias; alguns ensaios permitem
download de pesos somente quando a flag correspondente foi habilitada.
Fixtures de serviços hospedados e acesso autorizado a provedores ficam no projeto privado.

Para preparar runtimes locais em Windows x64, execute `bun run models:setup`.
Os binários têm versão e SHA256 verificados. As sete revisões de pesos avaliadas
foram retiradas de novos downloads/importações por qualidade insuficiente ou
qualificação incompleta. O catálogo ativo está vazio; configure APIs independentes
para texto, visão e transcrição. Instalações existentes permanecem utilizáveis
e removíveis, com aviso de retirada. Nenhum peso, histórico ou binding é apagado.
A estimativa de capacidade não garante qualidade ou desempenho em toda máquina.

O download automático revisado de runtimes atende somente Windows x64. Em
outros sistemas, use conexões por API ou configure manualmente um runtime
compatível: `ORVUNIA_LLAMA_RUNTIME_PATH`, `ORVUNIA_LLAMA_RUNTIME_SHA256` e
`ORVUNIA_LLAMA_RUNTIME_VERSION`, ou os três equivalentes
`ORVUNIA_WHISPER_RUNTIME_*` para transcrição. O caminho deve ser absoluto,
o hash SHA256 deve coincidir com o executável e a versão deve ser fixada.

No Linux/Ubuntu, a imagem pessoal mantém o bind em loopback. Use
`docker run --rm --network host -v orvunia-personal:/data orvunia-personal`
para persistir o perfil em um volume nomeado. No Windows, prefira `bun start`
ou o cliente Electron; não exponha a API pessoal em uma interface pública.

O cliente Electron usa um pacote de runtime Bun verificado. O código nativo pode
ser compilado por este projeto, mas um instalador assinado é um artefato separado.
Não aponte um runtime antigo para dados promovidos a um formato mais recente.

O site tem repositório privado independente e não integra os fontes do core.
O pacote @orvunia/core fornece entrypoints explícitos para extensões privadas;
não contém autenticação, assinatura, faturamento ou operação do produto cloud.
