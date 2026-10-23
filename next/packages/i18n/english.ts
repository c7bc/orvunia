import { accountEnglish } from "./account-english.ts";
import { deviceEnglish } from "./device-english.ts";
export const english = {
  model_retired: "This model is no longer offered for new installations because it has not met quality requirements. Existing installations are preserved.",
  local_model_busy: "Wait for the current operation or remove this model from its connections first.",
  local_model_invalid: "This model, artifact or configuration could not be validated. Check the selected files and settings.",
  local_model_unavailable: "The selected local capability is unavailable. Check its installation and runtime settings.",
  ...accountEnglish,
  ...deviceEnglish,
  asset_removed: "This capture was removed. Take a new capture.",
  plan_free: "Free",
  plan_supporter: "Supporter",
  billing_disabled: "Billing is unavailable in this installation.",
  billing_busy:
    "A billing operation is already in progress. Try again shortly.",
  billing_conflict:
    "Review your existing subscription or checkout before continuing.",
  billing_upstream: "The payment service could not complete this request.",
  billing_signature: "The payment event or its signature is invalid.",
  billing_reconciliation:
    "This payment attempt needs reconciliation before it can be repeated.",
  followup_conflict: "This draft or request changed. Reopen it before sending.",
  followup_disabled: "Email delivery is unavailable in this installation.",
  followup_verification: "Verify your email before sending messages.",
  followup_limit: "The daily email limit was reached.",
  calendar_configuration:
    "Configure Google OAuth credentials on the server and register /api/calendar/callback to connect your calendar.",
  calendar_state:
    "This authorization expired or belongs to another workspace. Connect again.",
  calendar_cancelled: "This calendar connection was disconnected or replaced.",
  calendar_connection: "Connect your Google calendar before synchronizing.",
  calendar_tokens:
    "The saved calendar authorization expired or could not be opened. Connect again.",
  calendar_unavailable:
    "The calendar provider could not complete this request. Try again.",
  calendar_denied:
    "Google calendar access was denied. Connect again and allow read access.",
  calendar_conflict:
    "Concurrent calendar changes could not be saved. Try again.",
  calendar_connected: "Calendar connected",
  calendar_declined: "Connection cancelled",
  calendar_return:
    "Return to Orvunia and refresh your calendar. You can close this tab.",
  calendar_untitled: "Untitled",
  realtime_unsupported:
    "This provider uses recorded chunks. Configure OpenAI or Deepgram for live transcription.",
  realtime_closed:
    "Live transcription disconnected. Resume the conversation and enable listening again.",
  realtime_limit: "The audio stream or concurrent channel limit was reached.",
  realtime_invalid: "The live transcription stream returned an invalid event.",
  realtime_pending: "Wait for the current audio synchronization to finish.",
  realtime_timeout:
    "The transcript has not confirmed all audio. Wait and try again.",
  realtime_short:
    "This audio tail is too short for another confirmation. Wait for more audio.",
  realtime_starting: "Live transcription is not ready yet.",
  response_not_found: "Answer not found.",
  expansion_not_found: "Prepared details not found.",
  expansion_pending: "The details are not ready yet.",
  expansion_expired:
    "The original context expired or was removed. Start a new request.",
  expansion_cancelled: "The preparation was cancelled.",
  document_import: "The document text could not be extracted.",
  invalid_document: "This PDF or DOCX document is invalid.",
  unsupported_document: "Use PDF, DOCX, text or source code.",
  document_too_large: "Use documents up to 5 MB.",
  empty_document:
    "No text could be extracted. For scanned pages, use an image as visual context.",
  invalid_audio:
    "Send a supported audio file. Cloud recording requires valid 16-bit PCM WAV.",
  audio_duration_limit: "Send cloud audio in segments up to 12 seconds.",
  operation_busy: "Another operation is still active. Wait for it to finish.",
  operation_unknown:
    "The provider outcome is unknown. Automatic replay is blocked.",
  operation_expired: "This prepared context expired. Start a new request.",
  snapshot_limit: "The retained request context limit was reached.",
  usage_limit: "Your current usage allowance was reached.",
  global_usage_limit: "AI capacity is temporarily unavailable.",
  daily_usage_limit: "Your daily usage limit has been reached.",
  monthly_usage_limit: "Your monthly usage allowance has been reached.",
  reservation_conflict:
    "This usage reservation has already been resolved differently.",
  reservation_unknown: "This usage reservation is awaiting reconciliation.",
  provider_unavailable: "The AI provider could not complete this request.",
  provider_auth:
    "The AI provider rejected the credential. Check your connections.",
  provider_limit: "The AI provider reached a usage limit. Try again later.",
  provider_request: "The AI provider rejected the model or request format.",
  provider_incomplete:
    "The response reached its output limit before completion.",
  vision_disabled:
    "Enable image support for this model or remove the screenshot.",
  provider_not_configured:
    "Configure the model and credential for this endpoint.",
  provider_settings_unreadable:
    "Saved connections could not be decrypted. Reconfigure them on this computer.",
  original_provider_changed:
    "Reconnect the original provider to repeat this prepared request.",
  invalid_image: "Use a PNG, JPEG or WebP image up to 4 MB.",
  asset_not_found: "Image not found.",
  asset_limit: "The private image storage quota was reached.",
  session_busy: "End the other session before resuming this one.",
  history_changed: "History changed. Reload this session.",
  request_conflict:
    "This request identity is already used for another operation.",
  mode_not_found: "Mode or template not found.",
  mode_limit: "You can create up to 100 modes.",
  builtin_mode: "Built-in modes cannot be removed or change their base type.",
  workspace_conflict: "Concurrent changes could not be saved. Try again.",
  conversation_not_found: "Conversation not found.",
  conversation_ended: "This conversation has ended.",
  notes_conflict: "These notes were changed in another window.",
  invalid_input: "Review the submitted fields.",
  unauthorized: "Authentication is required.",
  forbidden: "This request is not permitted.",
  internal_error: "The request could not be completed.",
  unavailable: "The service is temporarily unavailable.",
  rate_limited: "Too many requests. Try again later.",
  not_found: "Not found.",
} as const;
