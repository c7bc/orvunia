import type { CodingRegistry } from "./registry";
import type { Capture, Upload, UploadProgress } from "./domain";

export function captureQueue(
  registry: CodingRegistry,
  createURL: (blob: Blob) => string,
  maxPendingBytes: number,
) {
  return {
    stage(id: string, blob: Blob, name = "Contexto visual") {
      const state = registry.reserve(id);
      if (state.flushing)
        throw Error("Aguarde o envio das imagens em andamento.");
      if (
        !blob ||
        !["image/png", "image/jpeg", "image/webp"].includes(blob.type) ||
        !blob.size ||
        blob.size > 4 * 1024 * 1024
      )
        throw Error("Use uma imagem PNG, JPEG ou WebP de até 4 MB.");
      const oldest =
        state.captures.length === 3 ? state.captures[0] : undefined;
      if (
        registry.pendingBytes() + blob.size - (oldest?.blob?.size ?? 0) >
        maxPendingBytes
      )
        throw Error(
          "A fila de imagens atingiu o limite de memória. Remova imagens pendentes antes de adicionar outras.",
        );
      const preview = createURL(blob);
      if (oldest) registry.remove(state, oldest.id);
      state.captures.push({
        id: crypto.randomUUID(),
        blob,
        name: String(name).slice(0, 100),
        preview,
        ownsPreview: true,
        uploaded: null,
      });
      return { count: state.captures.length, evicted: Boolean(oldest) };
    },
    stageExisting(id: string, capture: Capture) {
      const state = registry.reserve(id);
      if (state.flushing)
        throw Error("Aguarde o envio das imagens em andamento.");
      if (!capture?.id || !capture.url)
        throw Error("Esta captura não está mais disponível.");
      if (state.captures.some((item) => item.uploaded?.id === capture.id))
        return;
      const oldest =
        state.captures.length === 3 ? state.captures[0] : undefined;
      if (oldest) registry.remove(state, oldest.id);
      state.captures.push({
        id: crypto.randomUUID(),
        name: String(capture.title || "Contexto visual").slice(0, 100),
        preview: capture.url,
        ownsPreview: false,
        uploaded: { ...capture },
      });
    },
    remove(id: string, captureId: string) {
      const state = registry.get(id);
      if (state.flushing) throw Error("Aguarde o envio das imagens.");
      registry.remove(state, captureId);
    },
    move(id: string, captureId: string, direction: number) {
      const state = registry.get(id);
      if (state.flushing) throw Error("Aguarde o envio das imagens.");
      const index = state.captures.findIndex((item) => item.id === captureId);
      const target = index + direction;
      const current = state.captures[index],
        other = state.captures[target];
      if (![1, -1].includes(direction) || !current || !other) return;
      [state.captures[index], state.captures[target]] = [other, current];
    },
    flush(
      id: string,
      upload: Upload,
      progress: UploadProgress = () => {},
      itemIds?: string[],
    ) {
      const state = registry.get(id);
      if (state.flushing) return state.flushing;
      const batch = itemIds
        ? itemIds.map((itemId) => {
            const item = state.captures.find(
              (capture) => capture.id === itemId,
            );
            if (!item)
              throw Error(
                "A fila desta solicitação mudou. Faça uma nova pergunta com o contexto atual.",
              );
            return item;
          })
        : [...state.captures];
      state.flushing = (async () => {
        const uploaded: Capture[] = [];
        for (const item of batch) {
          progress({ completed: uploaded.length, total: batch.length });
          if (!item.uploaded) {
            if (!item.blob)
              throw Error("Esta captura não está mais disponível.");
            item.uploaded = await upload(item.blob, item.name, item.id);
          }
          uploaded.push(item.uploaded);
        }
        return uploaded;
      })().finally(() => {
        state.flushing = null;
      });
      return state.flushing;
    },
    consume(id: string, itemIds: string[]) {
      const state = registry.get(id);
      if (state.flushing) throw Error("Aguarde o envio das imagens.");
      for (const itemId of itemIds) registry.remove(state, itemId);
    },
  };
}
