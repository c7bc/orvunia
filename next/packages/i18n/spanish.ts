import type { english } from "./english.ts";
export const spanish = {
  model_retired: "Este modelo ya no se ofrece para nuevas instalaciones porque no cumplió los requisitos de calidad. Se conservan las instalaciones existentes.",
  local_model_busy: "Espera a que termine la operación o elimina este modelo de las conexiones antes de continuar.",
  local_model_invalid: "No se pudo validar este modelo, archivo o configuración. Revisa los archivos y las opciones seleccionadas.",
  local_model_unavailable: "La capacidad local seleccionada no está disponible. Revisa su instalación y la configuración del runtime.",
  DELETE_CONFIRMATION_REQUIRED:
    "Escribe tu correo actual exacto para confirmar la eliminación.",
  ACCOUNT_BUSY:
    "Espera a que terminen las operaciones actuales antes de eliminar la cuenta.",
  ACCOUNT_SUBSCRIPTION_ACTIVE:
    "Cancela tu suscripción en el portal de facturación antes de eliminar la cuenta.",
  account_cleanup_pending:
    "Cuenta eliminada. La limpieza de datos privados está en cola.",
  AVATAR_INVALID:
    "Elige un PNG o JPEG válido de hasta 256 KB y 1.024 × 1.024 píxeles.",
  AVATAR_NOT_FOUND: "No se encontró la foto de perfil.",
  PASSWORD_EXISTS: "Esta cuenta ya tiene contraseña. Usa Cambiar contraseña.",
  AUTH_REQUIRED: "Inicia sesión para continuar.",
  EMAIL_UNAVAILABLE: "Esta dirección no está disponible.",
  EMAIL_LIMIT: "Elimina una dirección antes de añadir otra.",
  EMAIL_NOT_FOUND: "La dirección no existe o caducó.",
  EMAIL_COOLDOWN: "Espera un minuto antes de reenviar la verificación.",
  EMAIL_SEND_LIMIT:
    "Se alcanzó el límite de verificaciones. Inténtalo en una hora.",
  EMAIL_TOKEN_EXPIRED: "Este enlace de verificación no es válido o caducó.",
  PRIMARY_EMAIL_REQUIRED:
    "Elige otra dirección principal antes de eliminar esta.",
  EMAIL_NOT_VERIFIED:
    "Verifica esta dirección antes de establecerla como principal.",
  ACCOUNT_CONFIRMATION_LIMIT:
    "Espera cinco minutos antes de confirmar de nuevo.",
  FRESH_SESSION_REQUIRED:
    "Inicia sesión de nuevo antes de cambiar las direcciones de la cuenta.",
  PASSWORD_REQUIRED: "Confirma tu contraseña para continuar.",
  ACCOUNT_CONFIRMATION_REQUIRED: "Confirma tu identidad para continuar.",
  device_missing:
    "No se encontró la conexión. Empieza de nuevo desde la aplicación de escritorio.",
  device_expired:
    "Esta conexión caducó o ya se usó. Empieza de nuevo desde la aplicación.",
  device_proof: "Este dispositivo no pudo demostrar que posee la conexión.",
  device_conflict:
    "Esta conexión cambió. Empieza de nuevo desde la aplicación.",
  device_code:
    "El código de confirmación no coincide con la aplicación de escritorio.",
  device_limit:
    "Demasiadas conexiones de dispositivos. Espera antes de reintentar.",
  device_forbidden: "Esta solicitud de conexión no está autorizada.",
  device_approval:
    "Inicia sesión y verifica tu correo en el navegador; después aprueba una nueva conexión.",
  asset_removed: "Esta captura fue eliminada. Haz otra.",
  plan_free: "Gratis",
  plan_supporter: "Colaborador",
  billing_disabled: "La facturación no está disponible en esta instalación.",
  billing_busy:
    "Hay una operación de facturación en curso. Inténtalo en unos instantes.",
  billing_conflict:
    "Revisa tu suscripción o pago existente antes de continuar.",
  billing_upstream: "El servicio de pago no pudo completar la solicitud.",
  billing_signature: "El evento de pago o su firma no es válido.",
  billing_reconciliation:
    "Este intento de pago necesita conciliación antes de repetirse.",
  followup_conflict:
    "El borrador o la solicitud cambió. Ábrelo de nuevo antes de enviar.",
  followup_disabled:
    "El envío de correos no está disponible en esta instalación.",
  followup_verification: "Verifica tu correo antes de enviar mensajes.",
  followup_limit: "Se alcanzó el límite diario de correos.",
  calendar_configuration:
    "Configura las credenciales OAuth de Google en el servidor y registra /api/calendar/callback para conectar tu calendario.",
  calendar_state:
    "Esta autorización caducó o pertenece a otro espacio. Conecta de nuevo.",
  calendar_cancelled: "Esta conexión de calendario se desconectó o reemplazó.",
  calendar_connection: "Conecta tu calendario de Google antes de sincronizar.",
  calendar_tokens:
    "La autorización guardada caducó o no se pudo abrir. Conecta de nuevo.",
  calendar_unavailable:
    "El proveedor del calendario no pudo completar la solicitud. Inténtalo de nuevo.",
  calendar_denied:
    "Google denegó el acceso al calendario. Conecta de nuevo y permite la lectura.",
  calendar_conflict:
    "No se pudieron guardar los cambios simultáneos del calendario. Inténtalo de nuevo.",
  calendar_connected: "Calendario conectado",
  calendar_declined: "Conexión cancelada",
  calendar_return:
    "Vuelve a Orvunia y actualiza tu calendario. Puedes cerrar esta pestaña.",
  calendar_untitled: "Sin título",
  realtime_unsupported:
    "Este proveedor usa fragmentos grabados. Configura OpenAI o Deepgram para transcripción en directo.",
  realtime_closed:
    "La transcripción en directo se desconectó. Reanuda la conversación y activa la escucha de nuevo.",
  realtime_limit:
    "Se alcanzó el límite del flujo de audio o de canales simultáneos.",
  realtime_invalid:
    "El flujo de transcripción en directo devolvió un evento inválido.",
  realtime_pending: "Espera a que termine la sincronización de audio actual.",
  realtime_timeout:
    "La transcripción no ha confirmado todo el audio. Espera e inténtalo de nuevo.",
  realtime_short:
    "El fragmento final es demasiado corto para otra confirmación. Espera más audio.",
  realtime_starting: "La transcripción en directo aún no está lista.",
  response_not_found: "No se encontró la respuesta.",
  expansion_not_found: "No se encontró la ampliación preparada.",
  expansion_pending: "La ampliación aún no está lista.",
  expansion_expired:
    "El contexto original caducó o fue eliminado. Inicia una solicitud nueva.",
  expansion_cancelled: "La preparación se canceló.",
  document_import: "No se pudo extraer el texto del documento.",
  invalid_document: "Este documento PDF o DOCX no es válido.",
  unsupported_document: "Usa PDF, DOCX, texto o código fuente.",
  document_too_large: "Usa documentos de hasta 5 MB.",
  empty_document:
    "No se pudo extraer texto. Para páginas escaneadas, usa una imagen como contexto visual.",
  invalid_audio:
    "Envía un archivo de audio compatible. La grabación en la nube requiere WAV PCM válido de 16 bits.",
  audio_duration_limit:
    "Envía el audio de la nube en fragmentos de hasta 12 segundos.",
  operation_busy: "Otra operación sigue activa. Espera a que termine.",
  operation_unknown:
    "El resultado del proveedor es desconocido. La repetición automática está bloqueada.",
  operation_expired:
    "Este contexto preparado caducó. Inicia una solicitud nueva.",
  snapshot_limit: "Se alcanzó el límite de contexto retenido de solicitudes.",
  usage_limit: "Alcanzaste tu cuota de uso actual.",
  global_usage_limit: "La capacidad de IA no está disponible temporalmente.",
  daily_usage_limit: "Has alcanzado tu límite diario de uso.",
  monthly_usage_limit: "Has alcanzado tu cuota mensual de uso.",
  reservation_conflict: "Esta reserva de uso ya se resolvió de otra forma.",
  reservation_unknown: "Esta reserva de uso espera conciliación.",
  provider_unavailable: "El proveedor de IA no pudo completar la solicitud.",
  provider_auth:
    "El proveedor de IA rechazó la credencial. Revisa tus conexiones.",
  provider_limit:
    "El proveedor de IA alcanzó un límite de uso. Inténtalo más tarde.",
  provider_request:
    "El proveedor de IA rechazó el modelo o el formato de la solicitud.",
  provider_incomplete:
    "La respuesta alcanzó el límite de salida antes de terminar.",
  vision_disabled:
    "Activa la compatibilidad con imágenes de este modelo o elimina la captura.",
  provider_not_configured:
    "Configura el modelo y la credencial de este endpoint.",
  provider_settings_unreadable:
    "No se pudieron descifrar las conexiones guardadas. Configúralas de nuevo en este equipo.",
  original_provider_changed:
    "Conecta el proveedor original para repetir esta solicitud preparada.",
  invalid_image: "Usa una imagen PNG, JPEG o WebP de hasta 4 MB.",
  asset_not_found: "No se encontró la imagen.",
  asset_limit: "Se alcanzó la cuota de almacenamiento privado de imágenes.",
  session_busy: "Finaliza la otra sesión antes de reanudar esta.",
  history_changed: "El historial cambió. Vuelve a cargar esta sesión.",
  request_conflict:
    "La identidad de esta solicitud ya se usa para otra operación.",
  mode_not_found: "No se encontró el modo o la plantilla.",
  mode_limit: "Puedes crear hasta 100 modos.",
  builtin_mode:
    "Los modos integrados no pueden eliminarse ni cambiar de tipo base.",
  workspace_conflict:
    "No se pudieron guardar los cambios simultáneos. Inténtalo de nuevo.",
  conversation_not_found: "No se encontró la conversación.",
  conversation_ended: "Esta conversación terminó.",
  notes_conflict: "Estas notas se modificaron en otra ventana.",
  invalid_input: "Revisa los campos enviados.",
  unauthorized: "Es necesario autenticarse.",
  forbidden: "Esta solicitud no está permitida.",
  internal_error: "No se pudo completar la solicitud.",
  unavailable: "El servicio no está disponible temporalmente.",
  rate_limited: "Demasiadas solicitudes. Inténtalo más tarde.",
  not_found: "No encontrado.",
} satisfies Record<keyof typeof english, string>;
