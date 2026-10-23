import { accountPortuguese } from "./account-portuguese.ts";
import { devicePortuguese } from "./device-portuguese.ts";
export const portuguese = {
  model_retired: "Este modelo foi retirado de novas instalações por não atingir os requisitos de qualidade. As instalações existentes foram preservadas.",
  local_model_busy: "Aguarde a operação atual ou remova este modelo das conexões antes de continuar.",
  local_model_invalid: "Não foi possível validar este modelo, arquivo ou configuração. Confira os arquivos e as opções selecionadas.",
  local_model_unavailable: "A capacidade local selecionada está indisponível. Confira a instalação e as configurações do runtime.",
  ...accountPortuguese,
  ...devicePortuguese,
  asset_removed: "Esta captura foi removida. Tire uma nova captura.",
  plan_free: "Gratuito",
  plan_supporter: "Apoiador",
  billing_disabled: "A cobrança não está disponível nesta instalação.",
  billing_busy:
    "Uma operação de cobrança está em andamento. Tente novamente em instantes.",
  billing_conflict:
    "Revise sua assinatura ou checkout existente antes de continuar.",
  billing_upstream: "O serviço de pagamento não concluiu esta solicitação.",
  billing_signature: "O evento de pagamento ou sua assinatura é inválido.",
  billing_reconciliation:
    "Esta tentativa de pagamento precisa ser conciliada antes de ser repetida.",
  followup_conflict:
    "O rascunho ou a solicitação mudou. Reabra antes de enviar.",
  followup_disabled: "O envio de e-mails não está disponível nesta instalação.",
  followup_verification: "Confirme seu e-mail antes de enviar mensagens.",
  followup_limit: "O limite diário de e-mails foi atingido.",
  calendar_configuration:
    "Configure as credenciais OAuth do Google no servidor e cadastre /api/calendar/callback para conectar a agenda.",
  calendar_state:
    "Esta autorização expirou ou pertence a outro espaço. Conecte novamente.",
  calendar_cancelled: "Esta conexão de agenda foi encerrada ou substituída.",
  calendar_connection: "Conecte sua agenda Google antes de sincronizar.",
  calendar_tokens:
    "A autorização salva expirou ou não pôde ser aberta. Conecte a agenda novamente.",
  calendar_unavailable:
    "Não foi possível concluir a solicitação à agenda. Tente novamente.",
  calendar_denied:
    "O Google recusou o acesso à agenda. Reconecte e permita a leitura.",
  calendar_conflict:
    "Não foi possível salvar alterações simultâneas da agenda. Tente novamente.",
  calendar_connected: "Agenda conectada",
  calendar_declined: "Conexão cancelada",
  calendar_return:
    "Volte ao Orvunia e atualize a agenda. Você já pode fechar esta aba.",
  calendar_untitled: "Sem título",
  realtime_unsupported:
    "Este provedor usa transcrição por trechos. Configure OpenAI ou Deepgram para a escuta ao vivo.",
  realtime_closed:
    "A escuta foi desconectada. Retome a conversa e ative a escuta novamente.",
  realtime_limit:
    "O limite do fluxo de áudio ou de canais simultâneos foi atingido.",
  realtime_invalid:
    "O fluxo de transcrição ao vivo retornou um evento inválido.",
  realtime_pending: "Aguarde a sincronização de áudio em andamento.",
  realtime_timeout:
    "A transcrição ainda não confirmou todo o áudio. Aguarde e tente novamente.",
  realtime_short:
    "O trecho é curto demais para outra confirmação. Aguarde mais áudio.",
  realtime_starting: "A escuta ao vivo ainda não está pronta.",
  response_not_found: "Resposta não encontrada.",
  expansion_not_found: "Preparação não encontrada.",
  expansion_pending: "Os detalhes ainda não estão prontos.",
  expansion_expired:
    "O contexto original expirou ou foi removido. Faça uma nova pergunta.",
  expansion_cancelled: "A preparação foi cancelada.",
  document_import: "Não foi possível extrair o texto desse documento.",
  invalid_document: "Este documento PDF ou DOCX é inválido.",
  unsupported_document: "Use PDF, DOCX, texto ou código.",
  document_too_large: "Use documentos de até 5 MB.",
  empty_document:
    "Não há texto extraível. Para páginas escaneadas, use uma captura como contexto visual.",
  invalid_audio:
    "Envie um áudio compatível. Na cloud, use WAV PCM válido de 16 bits.",
  audio_duration_limit: "Envie o áudio cloud em trechos de até 12 segundos.",
  operation_busy: "Outra operação ainda está ativa. Aguarde sua conclusão.",
  operation_unknown:
    "O resultado no provedor é desconhecido. A repetição automática está bloqueada.",
  operation_expired:
    "Este contexto preparado expirou. Inicie uma nova solicitação.",
  snapshot_limit: "O limite de contexto das solicitações foi atingido.",
  usage_limit: "Sua franquia de uso atual foi atingida.",
  global_usage_limit: "A capacidade de IA está temporariamente indisponível.",
  daily_usage_limit: "Seu limite diário de uso foi atingido.",
  monthly_usage_limit: "Sua franquia mensal de uso foi atingida.",
  reservation_conflict: "Esta reserva de uso já foi resolvida de outra forma.",
  reservation_unknown: "Esta reserva de uso aguarda reconciliação.",
  provider_unavailable:
    "Não foi possível concluir a solicitação ao provedor de IA.",
  provider_auth:
    "O provedor recusou a credencial. Verifique as conexões de IA.",
  provider_limit:
    "O provedor atingiu um limite de uso. Tente novamente em instantes.",
  provider_request: "O provedor recusou o modelo ou o formato enviado.",
  provider_incomplete: "A resposta atingiu o limite antes de concluir.",
  vision_disabled: "Ative a visão neste modelo ou remova a captura.",
  provider_not_configured:
    "Configure o modelo e a credencial para este endereço.",
  provider_settings_unreadable:
    "Não foi possível abrir as conexões salvas. Reconfigure-as neste computador.",
  original_provider_changed:
    "Reconecte o provedor original para repetir esta solicitação preparada.",
  invalid_image: "Use uma imagem PNG, JPEG ou WebP de até 4 MB.",
  asset_not_found: "Imagem não encontrada.",
  asset_limit: "A cota de armazenamento de imagens foi atingida.",
  session_busy: "Encerre a outra sessão antes de retomar esta.",
  history_changed: "O histórico mudou. Recarregue a sessão.",
  request_conflict:
    "A identidade desta solicitação já está em uso por outra operação.",
  mode_not_found: "Modo ou modelo não encontrado.",
  mode_limit: "Você pode criar até 100 modos.",
  builtin_mode: "Os modos básicos não podem ser removidos nem mudar de tipo.",
  workspace_conflict:
    "Não foi possível salvar alterações simultâneas. Tente novamente.",
  conversation_not_found: "Conversa não encontrada.",
  conversation_ended: "Esta conversa já foi encerrada.",
  notes_conflict: "Estas notas foram alteradas em outra janela.",
  invalid_input: "Revise os campos enviados.",
  unauthorized: "É necessário autenticar a solicitação.",
  forbidden: "Esta solicitação não é permitida.",
  internal_error: "Não foi possível concluir a solicitação.",
  unavailable: "O serviço está temporariamente indisponível.",
  rate_limited: "Muitas solicitações. Tente novamente mais tarde.",
  not_found: "Não encontrado.",
} as const;
