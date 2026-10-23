import {
  connectionInput,
  responseProviders,
  transcriptionProviders,
} from "../contracts/providers.ts";
import { z } from "zod";
import { providerPresets, environmentKeys } from "./presets.ts";
import type { Connections } from "./domain.ts";

export function providerDefaults(
  environment: Record<string, string | undefined>,
): Connections {
  const response = z
    .enum(responseProviders)
    .parse(environment.CADENCE_RESPONSE_PROVIDER || "openai");
  const transcription = z
    .enum(transcriptionProviders)
    .parse(environment.CADENCE_TRANSCRIPTION_PROVIDER || "openai");
  const value = connectionInput.parse({
    response: {
      provider: response,
      model:
        environment.CADENCE_RESPONSE_MODEL ||
        environment.OPENAI_RESPONSE_MODEL ||
        "gpt-6-luna",
      baseUrl:
        environment.CADENCE_RESPONSE_BASE_URL ||
        providerPresets[response].baseUrl,
      vision: environment.CADENCE_VISION !== "false",
      maxTokens: Number(environment.CADENCE_MAX_OUTPUT_TOKENS || 3000),
    },
    transcription: {
      provider: transcription,
      model:
        environment.CADENCE_TRANSCRIPTION_MODEL ||
        environment.OPENAI_TRANSCRIPTION_MODEL ||
        "gpt-transcribe",
      baseUrl:
        environment.CADENCE_TRANSCRIPTION_BASE_URL ||
        providerPresets[transcription].baseUrl,
      realtimeModel:
        environment.OPENAI_REALTIME_TRANSCRIPTION_MODEL ||
        "gpt-live-transcribe",
    },
  });
  const {
    apiKey: _responseKey,
    clearKey: _responseClear,
    ...responseValue
  } = value.response;
  const {
    apiKey: _audioKey,
    clearKey: _audioClear,
    ...transcriptionValue
  } = value.transcription;
  return { response: responseValue, transcription: transcriptionValue };
}
export const providerEnvironmentKey = (
  environment: Record<string, string | undefined>,
  provider: string,
) => environment[environmentKeys[provider] ?? ""] ?? "";
