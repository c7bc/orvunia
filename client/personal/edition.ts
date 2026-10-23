import type { ApplicationEdition } from "../application-services/edition.js";
import { createPersonalWelcome } from "../onboarding/controller.js";
export const personalEdition: ApplicationEdition = {
  welcome: createPersonalWelcome,
  usageView: () => `<header class="settings-heading"><h2>Plano e uso</h2><p>Sua instalação local é gratuita e aberta.</p></header><section class="billing-local-card"><span class="version-badge">Open source · Local</span><h2>Seu computador.<br>Seus modelos.</h2><p>Sem assinatura, cadastro obrigatório ou limite de respostas do Orvunia.</p><ul><li>Backend integrado ao aplicativo</li><li>Provedores e modelos à sua escolha</li><li>Histórico e referências neste computador</li></ul><p>Configure suas conexões em <button class="text-button" data-settings-tab="providers">Provedores de IA</button>. O consumo é cobrado diretamente pelo provedor escolhido.</p></section>`,
};
