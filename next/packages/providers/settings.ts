import type {
  ConnectionKind,
  ConnectionRepository,
  Connections,
} from "./domain.ts";
import { ProviderError } from "./domain.ts";
import { providerPresets, canonicalEndpoint } from "./presets.ts";

type Edit<Value> = Value & { clearKey?: boolean };
export async function providerSettings(options: {
  initial: Connections;
  repository?: ConnectionRepository;
  editable: boolean;
  environmentKey(kind: ConnectionKind, provider: string): string;
  protection: "os" | "file" | "managed";
}) {
  let current = structuredClone(options.initial),
    unreadable = false;
  try {
    current = (await options.repository?.read()) ?? current;
  } catch {
    unreadable = true;
  }
  function effective<Kind extends ConnectionKind>(
    kind: Kind,
  ): Connections[Kind] & { apiKey: string } {
    const connection = current[kind],
      original = options.initial[kind];
    const address = canonicalEndpoint(connection.baseUrl);
    const trusted =
      address ===
        canonicalEndpoint(providerPresets[connection.provider].baseUrl) ||
      (connection.provider === original.provider &&
        address === canonicalEndpoint(original.baseUrl));
    return {
      ...connection,
      apiKey:
        connection.apiKey ||
        (trusted ? options.environmentKey(kind, connection.provider) : ""),
    };
  }
  function preview<Kind extends ConnectionKind>(
    kind: Kind,
    input?: Connections[Kind],
  ) {
    if (!input) return effective(kind);
    if (!options.editable) throw new ProviderError("provider_request", 403);
    const previous = effective(kind);
    const same =
      input.provider === previous.provider &&
      canonicalEndpoint(input.baseUrl) === canonicalEndpoint(previous.baseUrl);
    const canonical =
      canonicalEndpoint(input.baseUrl) ===
      canonicalEndpoint(providerPresets[input.provider].baseUrl);
    return {
      ...input,
      apiKey:
        input.apiKey ||
        (same
          ? previous.apiKey
          : canonical
            ? options.environmentKey(kind, input.provider)
            : ""),
    };
  }
  const ready = (kind: ConnectionKind) => {
    const connection = effective(kind);
    return Boolean(
      connection.model &&
      (connection.apiKey ||
        ["compatible", "ollama"].includes(connection.provider)),
    );
  };
  const realtime = () =>
    ["openai", "deepgram"].includes(current.transcription.provider) &&
    ready("transcription");
  function publicSettings() {
    const safe = (kind: ConnectionKind) => {
      const { apiKey, ...connection } = current[kind];
      const configured = effective(kind).apiKey;
      return {
        ...connection,
        keyConfigured: Boolean(configured),
        keySource: apiKey ? "saved" : configured ? "environment" : "none",
      };
    };
    return {
      editable: options.editable,
      response: safe("response"),
      transcription: safe("transcription"),
      realtimeSupported: realtime(),
      protection: options.protection,
      loadError: unreadable ? "provider_settings_unreadable" : "",
      presets: providerPresets,
    };
  }
  async function save(input: {
    response: Edit<Connections["response"]>;
    transcription: Edit<Connections["transcription"]>;
  }) {
    if (!options.editable || !options.repository)
      throw new ProviderError("provider_request", 403);
    const next = structuredClone(input);
    for (const kind of ["response", "transcription"] as const) {
      const connection = next[kind],
        previous = current[kind];
      if (connection.clearKey) delete connection.apiKey;
      else if (
        !connection.apiKey &&
        connection.provider === previous.provider &&
        canonicalEndpoint(connection.baseUrl) ===
          canonicalEndpoint(previous.baseUrl)
      ) {
        if (previous.apiKey) connection.apiKey = previous.apiKey;
      }
      delete connection.clearKey;
    }
    await options.repository.write(next);
    current = next;
    unreadable = false;
    return publicSettings();
  }
  return { effective, preview, ready, realtime, public: publicSettings, save };
}
export type ProviderSettings = Awaited<ReturnType<typeof providerSettings>> & {
  legacyReady?: (kind: ConnectionKind) => boolean;
};
