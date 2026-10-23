import type { GazeRuntime } from "./runtime";
import type { GazeSignal } from "./contracts";
import { gazeWorkerMessage } from "./worker-message";
export function gazeWorker(
  runtime: GazeRuntime,
  run: number,
  consume: (signal: GazeSignal | null, timestamp: number) => void,
) {
  const worker = runtime.browser.worker();
  let rejectInit: ((error: Error) => void) | null = null,
    timer: number | undefined;
  function failure(message: string) {
    if (rejectInit) {
      const reject = rejectInit;
      rejectInit = null;
      runtime.browser.cancel(timer);
      reject(Error(message));
    } else runtime.fail(message);
  }
  const ready = new Promise<void>((resolve, reject) => {
    rejectInit = reject;
    timer = runtime.browser.later(
      () => failure("O modelo local não iniciou em 30 segundos."),
      30000,
    );
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (run !== runtime.generation) return;
      const message = gazeWorkerMessage(event.data);
      if (message?.type === "ready") {
        runtime.browser.cancel(timer);
        rejectInit = null;
        resolve();
      }
      if (message?.type === "error") failure(message.message);
      if (message?.type === "result")
        consume(message.signal, message.timestamp);
    };
    worker.onerror = () => {
      if (run !== runtime.generation) return;
      failure(
        rejectInit
          ? "Não foi possível abrir o modelo local. Confira os arquivos WASM e as permissões do aplicativo."
          : "O processamento local foi interrompido. A câmera foi desligada.",
      );
    };
  });
  worker.postMessage({ type: "init" });
  return {
    worker,
    ready,
    close() {
      runtime.browser.cancel(timer);
      rejectInit?.(Error("Inicialização cancelada."));
      rejectInit = null;
      worker.terminate();
    },
  };
}
export type GazeWorker = ReturnType<typeof gazeWorker>;
