import type { Configuration, Capability, Connection } from "./domain.js";
import { capabilities } from "./domain.js";
export function connectionInput(form: HTMLFormElement, configuration: Configuration) {
  const field = (capability: Capability, name: string) => {
    const element = form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${capability}.${name}"]`);
    if (!element) throw Error("Campo de conexão indisponível.");
    return element;
  };
  const checked = (capability: Capability, name: string) => (field(capability, name) as HTMLInputElement).checked;
  const bindings = structuredClone(configuration.bindings);
  const edits = new Map<string, Omit<Connection, "keyConfigured" | "keySource"> & { secret:
    { operation: "keep" | "clear" } | { operation: "replace"; value: string } }>();
  for (const capability of capabilities) {
    const kind = field(capability, "kind").value;
    if (kind === "disabled") { bindings[capability] = { kind }; continue; }
    if (kind === "shared" && capability === "vision") { bindings.vision = { kind, capability: "text" }; continue; }
    if (kind === "local") {
      const installationId = field(capability, "installation").value;
      if (!installationId) throw Error("Selecione um modelo instalado");
      bindings[capability] = { kind, installationId }; continue;
    }
    if (kind !== "api") throw Error("Conexão inválida.");
    const selected = field(capability, "connection").value;
    const previous = configuration.connections.find((item) => item.id === selected);
    const id = previous?.id ?? `${capability}-${crypto.randomUUID()}`;
    if (edits.has(id)) throw Error("Para compartilhar texto e visão, escolha Usar o modelo de texto.");
    const key = field(capability, "key").value.trim(), clear = checked(capability, "clear");
    const acceptsImages = capability === "text" && checked(capability, "vision");
    edits.set(id, { id, revision: previous?.revision ?? 1, provider: field(capability, "provider").value,
      baseUrl: field(capability, "baseUrl").value.trim(), model: field(capability, "model").value.trim(),
      capabilities: capability === "text" && acceptsImages ? ["text", "vision"] : [capability],
      parameters: capability === "text" ? { maxTokens: Number(field(capability, "maxTokens").value), vision: acceptsImages } :
        previous?.parameters ?? {}, secret: clear ? { operation: "clear" } : key ? { operation: "replace", value: key } : { operation: "keep" } });
    bindings[capability] = { kind, connectionId: id };
  }
  const connections = configuration.connections.map(({ keyConfigured: _configured, keySource: _source, ...connection }) =>
    edits.get(connection.id) ?? { ...connection, secret: { operation: "keep" as const } });
  for (const [id, edit] of edits) if (!configuration.connections.some((item) => item.id === id)) connections.push(edit);
  return { schemaVersion: 2 as const, expectedRevision: configuration.revision, bindings, connections };
}
