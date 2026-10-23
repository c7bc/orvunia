import WebSocket from "ws-transport";
import type { UpstreamFactory } from "./domain.ts";
export const socketUpstream: UpstreamFactory = (address, headers) => {
  const socket = new WebSocket(address, {
    headers,
    perMessageDeflate: false,
    followRedirects: false,
    handshakeTimeout: 15_000,
    maxPayload: 1024 * 1024,
  });
  return {
    open: () => socket.readyState === WebSocket.OPEN,
    bufferedBytes: () => socket.bufferedAmount,
    send: (value) => socket.send(value),
    close: () =>
      socket.readyState === WebSocket.CONNECTING
        ? socket.terminate()
        : socket.close(),
    opened: (callback) => {
      socket.once("open", callback);
    },
    message: (callback) => {
      socket.on("message", (data, binary) => {
        callback(binary ? data : data.toString());
      });
    },
    ended(callback) {
      socket.once("close", callback);
      socket.once("error", callback);
    },
  };
};
