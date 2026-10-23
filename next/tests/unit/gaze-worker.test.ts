import { expect, test } from "bun:test";
import { localGazeNetwork } from "../../../client/gaze/worker-network.ts";
import { installGazeWorker } from "../../../client/gaze/worker-engine.ts";
import type { GazeWorkerScope } from "../../../client/gaze/worker-scope.ts";
function environment() {
  const fetched: { url: string; redirect: RequestRedirect | undefined }[] = [],
    scripts: (string | URL)[] = [],
    requests: (string | URL)[] = [],
    messages: unknown[] = [];
  let closed = 0;
  class Request {
    open(_method: string, url: string | URL) {
      requests.push(url);
    }
  }
  const scope: GazeWorkerScope = {
    location: {
      href: "http://127.0.0.1:9915/assets/gaze/gaze-worker.js",
      origin: "http://127.0.0.1:9915",
    },
    fetch: async (url, options) => {
      fetched.push({ url: String(url), redirect: options?.redirect });
      return new Response("synthetic");
    },
    XMLHttpRequest: Request as unknown as typeof XMLHttpRequest,
    importScripts: (...urls) => {
      scripts.push(...urls);
    },
    WebSocket: null,
    EventSource: null,
    onmessage: null,
    postMessage: (message) => {
      messages.push(message);
    },
    close: () => {
      closed++;
    },
  };
  const send = async (data: unknown) =>
    scope.onmessage?.({ data } as MessageEvent<unknown>);
  return {
    scope,
    fetched,
    scripts,
    requests,
    messages,
    send,
    closed: () => closed,
  };
}
test("gaze worker permits bundled assets and blocks remote fetch, redirects, XHR, scripts and sockets", async () => {
  const env = environment();
  localGazeNetwork(env.scope);
  await env.scope.fetch("./face_landmarker.task", { redirect: "follow" });
  expect(env.fetched).toHaveLength(1);
  expect(env.fetched[0]?.redirect).toBe("error");
  await expect(
    env.scope.fetch("https://remote.example.test/video"),
  ).rejects.toThrow("apenas recursos locais");
  await expect(env.scope.fetch("/api/providers")).rejects.toThrow(
    "apenas recursos locais",
  );
  expect(env.fetched).toHaveLength(1);
  const request = new env.scope.XMLHttpRequest!();
  request.open("GET", "./wasm/vision_wasm_internal.wasm");
  expect(() =>
    request.open("POST", "https://remote.example.test/metrics"),
  ).toThrow("apenas recursos locais");
  expect(env.requests).toHaveLength(1);
  env.scope.importScripts("./wasm/vision_wasm_internal.js");
  expect(() =>
    env.scope.importScripts("https://remote.example.test/script.js"),
  ).toThrow("apenas recursos locais");
  expect(env.scripts).toHaveLength(1);
  const Socket = env.scope.WebSocket as new () => unknown,
    Source = env.scope.EventSource as new () => unknown;
  expect(() => new Socket()).toThrow("Rede externa desabilitada");
  expect(() => new Source()).toThrow("Rede externa desabilitada");
});
test("worker releases image frames even on inference error and refuses malformed timestamps", async () => {
  const env = environment();
  let closedFrames = 0,
    inferences = 0,
    closedModels = 0;
  installGazeWorker(env.scope, async () => ({
    detectForVideo() {
      inferences++;
      throw Error("Synthetic inference failure");
    },
    close() {
      closedModels++;
    },
  }));
  await env.send({ type: "init" });
  await env.send({ type: "init" });
  expect(env.messages).toEqual([{ type: "ready" }]);
  const frame = {
    width: 640,
    height: 480,
    close: () => {
      closedFrames++;
    },
  };
  await env.send({ type: "frame", id: 1, timestamp: 1, frame });
  await env.send({ type: "frame", id: 2, timestamp: NaN, frame });
  expect(inferences).toBe(1);
  expect(closedFrames).toBe(2);
  expect(env.messages).toContainEqual({
    type: "error",
    id: 1,
    message: "Synthetic inference failure",
  });
  await env.send({ type: "stop" });
  expect(env.closed()).toBe(1);
  expect(closedModels).toBe(1);
});
test("stopping during model loading closes a late model without restoring readiness", async () => {
  const env = environment();
  let resolve: (model: {
      detectForVideo(): { faceLandmarks: never[] };
      close(): void;
    }) => void,
    closed = 0;
  const loading = new Promise<{
    detectForVideo(): { faceLandmarks: never[] };
    close(): void;
  }>((done) => {
    resolve = done;
  });
  installGazeWorker(env.scope, () => loading);
  const pending = env.send({ type: "init" });
  await env.send({ type: "stop" });
  resolve!({
    detectForVideo: () => ({ faceLandmarks: [] }),
    close: () => {
      closed++;
    },
  });
  await pending;
  expect(closed).toBe(1);
  expect(env.closed()).toBe(1);
  expect(env.messages).toEqual([]);
});
