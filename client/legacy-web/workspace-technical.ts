import {
  workspaceProblem,
  type WorkspaceContext,
  type WorkspaceController,
} from "./workspace-types.js";
export function createWorkspaceTechnical({
  state: browser,
  ports,
  workspace,
}: WorkspaceContext): Pick<WorkspaceController, "technicalContent"> {
  return {
    technicalContent() {
      const p = workspaceProblem(
        ports,
        browser.currentProblem,
        browser.preferences.output,
      );
      const l = (portuguese: string, spanish: string) =>
        browser.preferences.output.startsWith("es") ? spanish : portuguese;
      if (browser.answerKind === "custom")
        return `<div class="answer-label">${ports.icon("spark")}${l("PERGUNTA TÉCNICA", "PREGUNTA TÉCNICA")}</div><h3 class="answer-title">${l("Explore a abordagem.", "Explora el enfoque.")}</h3><p class="answer-summary">${ports.escape(browser.customQuestion)}</p><div class="answer-card"><p>${l("Esta demo possui soluções locais para três desafios. Selecione um deles e explore código, raciocínio, complexidade e testes. Sua pergunta fica registrada como contexto da sessão.", "Esta demostración incluye soluciones locales para tres desafíos. Selecciona uno y explora código, razonamiento, complejidad y pruebas. Tu pregunta queda registrada como contexto de la sesión.")}</p></div>${workspace.answerMeta(l("Demonstração local", "Demostración local"))}`;
      if (browser.answerKind === "hint")
        return `<div class="answer-label">${ports.icon("bulb")}${l("UMA DICA, PRIMEIRO", "UNA PISTA PRIMERO")}</div><h3 class="answer-title">${ports.escape(p.title)}</h3><div class="answer-card"><p>${ports.escape(p.steps[0])} ${l("Pense em qual estrutura de dados permite continuar essa estratégia de forma eficiente.", "Piensa qué estructura de datos permite continuar esta estrategia de forma eficiente.")}</p></div><p class="answer-summary" style="margin-top:15px">${l("Explique suas premissas antes de partir para o código.", "Explica tus supuestos antes de escribir código.")}</p>${workspace.answerMeta(l("Dica de exemplo", "Pista de ejemplo"))}`;
      if (browser.answerKind === "design")
        return `<div class="answer-label">${ports.icon("layers")}${l("ARQUITETURA DE SISTEMAS", "ARQUITECTURA DE SISTEMAS")}</div><h3 class="answer-title">${l("Comece pelos requisitos.", "Empieza por los requisitos.")}</h3><p class="answer-summary">${l("Roteiro de prática para projetar um serviço de notificações.", "Guía de práctica para diseñar un servicio de notificaciones.")}</p><div class="answer-card"><p>${l("1. Defina canais, volume e requisitos de entrega.", "1. Define canales, volumen y requisitos de entrega.")}<br>${l("2. Desacople a API dos provedores usando uma fila.", "2. Desacopla la API de los proveedores usando una cola.")}<br>${l("3. Use consumidores para email, push e SMS.", "3. Usa consumidores para correo, push y SMS.")}<br>${l("4. Planeje idempotência, retentativas e fila de falhas.", "4. Planifica idempotencia, reintentos y cola de fallos.")}<br>${l("5. Discuta observabilidade, privacidade e custos.", "5. Analiza observabilidad, privacidad y costes.")}</p></div><ul class="answer-notes"><li>${ports.icon("check")}<span>${l("Discuta latência e garantia de entrega.", "Analiza la latencia y las garantías de entrega.")}</span></li><li>${ports.icon("check")}<span>${l("Justifique escolhas com as restrições do problema.", "Justifica las decisiones con las restricciones del problema.")}</span></li></ul>${workspace.answerMeta(l("Cenário de prática", "Escenario de práctica"))}`;
      let content = "";
      if (browser.codeTab === "code") {
        content = `<div class="code-block"><div class="code-toolbar"><span>${browser.preferences.code === "Python" ? "solution.py" : "solution." + (browser.preferences.code === "TypeScript" ? "ts" : "js")}</span><button data-action="copy-code">${ports.icon("copy")}Copiar código</button></div><pre><code>${ports.escape(p.codes[browser.preferences.code])}</code></pre></div>`;
      }
      if (browser.codeTab === "reasoning") {
        content = `<div class="answer-card"><p>${ports.escape(p.approach)}</p></div><ul class="answer-notes">${p.steps.map((s, i) => `<li>${ports.icon("check")}<span>${i + 1}. ${ports.escape(s)}</span></li>`).join("")}</ul>${browser.answerKind === "debug" ? `<div class="context-warning">${browser.currentProblem === "two-sum" ? l("Busque o complemento antes de inserir o valor atual, para não reutilizar o mesmo índice.", "Busca el complemento antes de insertar el valor actual para no reutilizar el mismo índice.") : browser.currentProblem === "parentheses" ? l("Verifique o fechamento sem abertura e a pilha vazia ao final.", "Comprueba los cierres sin apertura y que la pila quede vacía al final.") : l("Use left ≤ right e mova os limites em mid ± 1 para evitar loops.", "Usa left ≤ right y mueve los límites en mid ± 1 para evitar bucles.")}</div>` : ""}`;
      }
      if (browser.codeTab === "complexity") {
        content = `<div class="complexity-row"><div><small>${l("Tempo", "Tiempo")}</small><b>${p.time}</b></div><div><small>${l("Espaço adicional", "Espacio adicional")}</small><b>${p.space}</b></div></div><p class="answer-summary">${ports.escape(p.tradeoff)}</p>`;
      }
      if (browser.codeTab === "tests") {
        content = `<p class="answer-summary">${l("Execute casos de exemplo na implementação JavaScript incluída nesta demo. Isso não executa código digitado nem a versão Python.", "Ejecuta ejemplos con la implementación JavaScript incluida. Esto no ejecuta el código escrito ni la versión Python.")}</p><button class="secondary" data-action="run-tests">${ports.icon("play")}${l("Executar exemplos", "Ejecutar ejemplos")}</button>${browser.testsRun ? `<p class="test-heading">${browser.testResults.filter((t) => t.passed).length}/${browser.testResults.length} ${l("casos passaram", "casos aprobados")}</p>${browser.testResults.map((t, i) => `<div class="test-row">${ports.icon(t.passed ? "check" : "close")}<div>Caso ${i + 1} · ${t.passed ? l("Passou", "Aprobado") : l("Falhou", "Falló")}<small>${ports.escape(t.input)} → ${ports.escape(JSON.stringify(t.actual))}</small></div></div>`).join("")}` : ""}`;
      }
      return `<div class="answer-label">${ports.icon("code")}${l("RACIOCÍNIO + IMPLEMENTAÇÃO", "RAZONAMIENTO + IMPLEMENTACIÓN")}</div><h3 class="answer-title">${browser.answerKind === "debug" ? l("Revise os casos limite.", "Revisa los casos límite.") : p.title + l(": uma abordagem eficiente.", ": un enfoque eficiente.")}</h3><div class="technical-toolbar"><label for="code-language">${l("Linguagem", "Lenguaje")}</label><select id="code-language">${["TypeScript", "JavaScript", "Python"].map((l) => `<option ${l === browser.preferences.code ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="code-tabs" role="tablist" aria-label="${l("Solução técnica", "Solución técnica")}">${[
        ["code", "Código"],
        ["reasoning", l("Raciocínio", "Razonamiento")],
        ["complexity", l("Complexidade", "Complejidad")],
        ["tests", l("Testes", "Pruebas")],
      ]
        .map(
          ([id, title]) =>
            `<button role="tab" aria-selected="${id === browser.codeTab}" class="${id === browser.codeTab ? "active" : ""}" data-code-tab="${id}">${title}</button>`,
        )
        .join(
          "",
        )}</div>${content}${workspace.answerMeta(l("Solução local de exemplo", "Solución local de ejemplo"))}`;
    },
  };
}
