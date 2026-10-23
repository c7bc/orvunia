import type { DiagnosticFailure } from "./contracts";
export function diagnosticFailure(
  code: string,
  message: string,
): DiagnosticFailure {
  return Object.assign(new Error(message), {
    name: "MicrophoneTestError",
    code,
  });
}
export function diagnosticError(error: unknown): DiagnosticFailure {
  const value = error && typeof error === "object" ? error : {},
    name = "name" in value ? value.name : null;
  if (name === "NotAllowedError" || name === "SecurityError")
    return diagnosticFailure(
      "permission_denied",
      "O acesso ao microfone foi negado. Revise a permissão do aplicativo e tente novamente.",
    );
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return diagnosticFailure(
      "device_not_found",
      "Nenhum microfone compatível foi encontrado. Selecione outra fonte.",
    );
  if (name === "NotReadableError")
    return diagnosticFailure(
      "device_unavailable",
      "O microfone está indisponível ou em uso por outro aplicativo.",
    );
  if ("code" in value && typeof value.code === "string")
    return diagnosticFailure(
      value.code,
      "message" in value ? String(value.message) : value.code,
    );
  return diagnosticFailure(
    "audio_error",
    "Não foi possível concluir o teste local do microfone.",
  );
}
