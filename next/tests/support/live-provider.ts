import type { UpstreamFactory } from "../../packages/realtime/domain.ts";
export function controlledLiveProvider() {
  const streams: {
    address: URL;
    headers: Record<string, string>;
    sent: unknown[];
    closed: boolean;
    emit(value: unknown): void;
    buffered: number;
    failSend: boolean;
  }[] = [];
  const factory: UpstreamFactory = (address, headers) => {
    let opened = () => {},
      ended = () => {},
      message = (_value: unknown) => {};
    const stream = {
      address,
      headers,
      sent: [] as unknown[],
      closed: false,
      buffered: 0,
      failSend: false,
      emit(value: unknown) {
        message(typeof value === "string" ? value : JSON.stringify(value));
      },
    };
    streams.push(stream);
    queueMicrotask(() => opened());
    return {
      open: () => !stream.closed,
      bufferedBytes: () => stream.buffered,
      send(value) {
        if (stream.failSend) throw Error("Synthetic uncertain send");
        const data: unknown =
          typeof value === "string" ? JSON.parse(value) : new Uint8Array(value);
        stream.sent.push(data);
        if (
          data &&
          typeof data === "object" &&
          "type" in data &&
          data.type === "session.update"
        )
          queueMicrotask(() => stream.emit({ type: "session.updated" }));
      },
      close() {
        if (!stream.closed) {
          stream.closed = true;
          ended();
        }
      },
      opened: (callback) => {
        opened = callback;
      },
      ended: (callback) => {
        ended = callback;
      },
      message: (callback) => {
        message = callback;
      },
    };
  };
  return { factory, streams };
}
export async function waitUntil(condition: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 3000;
  while (!(await condition())) {
    if (Date.now() >= deadline) throw Error("Realtime fixture timed out");
    await Bun.sleep(5);
  }
}
