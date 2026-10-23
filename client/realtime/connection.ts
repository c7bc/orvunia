import type { RealtimeAudio } from "./recorder";
import type {
  FinalCallback,
  RealtimeOptions,
  RealtimeStateCallback,
} from "./contracts";
import { serverEvent } from "./protocol";
import { audioFailure } from "../audio/contracts";

export async function connect(
  state: RealtimeAudio,
  source: string,
  onFinal: FinalCallback,
  onState: RealtimeStateCallback,
  options: RealtimeOptions,
) {
  const confirmation = state.confirmation;
  const response = await state.platform.request(
    `/api/sessions/${options.sessionId}/realtime-ticket`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Cadence-Request": "1" },
      body: JSON.stringify({
        who: source === "display" ? "Entrevistador" : "Eu",
      }),
    },
  );
  const value: unknown = await response.json();
  const data =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  if (!response.ok) {
    const error =
      data.error && typeof data.error === "object"
        ? (data.error as Record<string, unknown>)
        : {};
    throw Error(
      typeof error.message === "string"
        ? error.message
        : "Não foi possível abrir a escuta.",
    );
  }
  if (typeof data.ticket !== "string" || data.ticket.length > 4096)
    throw Error("Não foi possível abrir a escuta.");
  const socket = (state.ws = state.platform.socket(data.ticket));
  await new Promise<void>((resolve, reject) => {
    let ready = false;
    const timer = setTimeout(() => {
      socket.close();
      reject(Error("A conexão de transcrição demorou para iniciar."));
    }, 19000);
    socket.onmessage = (event) => {
      try {
        const value = serverEvent(event.data);
        if (!value) return;
        switch (value.type) {
          case "ready":
            state.supportsFlush = value.supportsFlush;
            ready = true;
            clearTimeout(timer);
            resolve();
            break;
          case "delta":
            onState("transcribing");
            if (value.replace) options.onPartial?.(value.itemId, "", true, value.utteranceId);
            options.onPartial?.(value.itemId, value.text, false, value.utteranceId);
            break;
          case "final": {
            const delivered = state.finalDelivery();
            state.pending = Math.max(0, state.pending - 1);
            const confirmed = state.pending === 0 ? confirmation.committed : 0;
            options.onPartial?.(value.itemId, "", true, value.transcript?.utteranceId);
            const transcript = value.transcript;
            confirmation.deliveriesPending++;
            if (!transcript) onState("recording");
            state.deliveries = state.deliveries
                .then(() => transcript ? onFinal(transcript) : undefined)
                .catch((error: unknown) => {
                  state.error = audioFailure(error);
                  confirmation.failure = state.error;
                  onState("error", state.error.message);
                }).then(() => { if (!confirmation.failure) confirmation.confirm(confirmed); })
                .finally(() => {
                  confirmation.deliveriesPending--;
                  delivered();
                  if (state.pending === 0 && confirmation.deliveriesPending === 0) state.pendingSince = undefined;
                  onState("queued", state.pending + confirmation.deliveriesPending);
                });
            break;
          }
          case "flushed": {
            const watermark = confirmation.flushed(value.id);
            if (watermark !== undefined) state.deliveries = state.deliveries.then(() => {
              if (!confirmation.failure) confirmation.confirm(watermark);
            });
            state.waiters.get("server:" + value.id)?.resolve();
            break;
          }
          case "flush-error":
            state.waiters
              .get("server:" + value.id)
              ?.reject(Error(value.message));
            break;
          case "error":
            throw Error(value.message);
        }
      } catch (error) {
        state.error = audioFailure(error);
        state.rejectFlushes(state.error);
        clearTimeout(timer);
        if (!ready) reject(state.error);
        else {
          onState("error", state.error.message);
          void state.stop();
        }
      }
    };
    socket.onerror = () => {
      state.error = Error("A conexão de transcrição foi interrompida.");
      state.rejectFlushes(state.error);
      clearTimeout(timer);
      if (!ready) reject(Error("Falha na conexão de transcrição."));
      else onState("error", state.error.message);
    };
    socket.onclose = () => {
      state.rejectFlushes(Error("A escuta foi desconectada."));
      clearTimeout(timer);
      if (!ready) reject(Error("A conexão de transcrição foi recusada."));
      if (state.running && !state.stopping) {
        onState("error", "A escuta foi desconectada. Ative-a novamente.");
        void state.stop();
      }
    };
  });
  return socket;
}
