import type { ApplicationState } from "./model.js";
import type { ApplicationRequest } from "./request.js";
import type { createCodingWorkspace } from "../coding/workspace.js";
import type { CaptureTarget } from "../captures/contracts.js";
import type { Capture } from "../coding/domain.js";
import { record, text } from "../legacy-web/validation.js";

export function createApplicationUploads(ports: {
  state: ApplicationState;
  request: ApplicationRequest;
  coding: ReturnType<typeof createCodingWorkspace>;
  render(): void;
  toast(message: string): void;
  changed(): void;
}) {
  const { state } = ports;
  async function upload(
    blob: Blob,
    name: string,
    sessionId: string,
    signal?: AbortSignal,
    uploadKey?: string,
  ): Promise<Capture> {
    if (!blob) throw Error("Não foi possível preparar a imagem.");
    if (blob.size > 4 * 1024 * 1024)
      throw Error("A imagem deve ter até 4 MB. Selecione uma região menor.");
    const workspace = state.workspaceKey,
      body = new FormData();
    body.append(
      "file",
      blob,
      blob.type === "image/png" ? "contexto.png" : "contexto.jpg",
    );
    const input = record(
      await ports.request(
        `/sessions/${sessionId}/captures`,
        "POST",
        body,
        signal,
        {
          ...(uploadKey ? { "Idempotency-Key": uploadKey } : {}),
          "X-Cadence-Workspace": workspace.slice("cadence-agenda:".length),
        },
      ),
    );
    const capture = {
      ...input,
      id: text(input.id),
      url: text(input.url),
      ...(input.title === undefined ? {} : { title: text(input.title) }),
      ...(input.time === undefined ? {} : { time: text(input.time) }),
    };
    signal?.throwIfAborted();
    if (state.workspaceKey !== workspace)
      throw new DOMException("Workspace changed", "AbortError");
    if (
      state.current?.id === sessionId &&
      !state.current.captures.some((item) => item.id === capture.id)
    )
      state.current.captures.push(capture);
    ports.changed();
    return capture;
  }
  async function save(
    blob: Blob,
    name = "Contexto visual",
    target: CaptureTarget | null = state.current,
    workspace = state.workspaceKey,
  ) {
    if (workspace !== state.workspaceKey)
      throw new DOMException("Workspace changed", "AbortError");
    if (!target || target.state !== "active")
      throw Error("Inicie ou retome a sessão antes de capturar.");
    if (target.mode === "technical") {
      const queued = ports.coding.stage(target.id, blob, name);
      ports.render();
      ports.toast(
        queued.evicted
          ? "Fila completa: a captura pendente mais antiga foi substituída."
          : "Imagem na fila. Ela será anexada à próxima pergunta.",
      );
      return;
    }
    await upload(blob, name, target.id);
    ports.render();
    ports.toast("Captura adicionada ao contexto.");
  }
  return { upload, save };
}
