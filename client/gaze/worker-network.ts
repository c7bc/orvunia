import type { GazeWorkerScope } from "./worker-scope";
export function localGazeNetwork(scope: GazeWorkerScope) {
  function localAsset(input: RequestInfo | URL) {
    const url = new URL(
      typeof input === "string" || input instanceof URL
        ? String(input)
        : input.url,
      scope.location.href,
    );
    if (
      url.origin !== scope.location.origin ||
      !url.pathname.startsWith("/assets/gaze/")
    )
      throw Error("O processamento do olhar permite apenas recursos locais.");
    return url;
  }
  const localFetch = scope.fetch.bind(scope);
  scope.fetch = (input, options) => {
    try {
      localAsset(input);
      return localFetch(input, { ...options, redirect: "error" });
    } catch (error) {
      return Promise.reject(error);
    }
  };
  if (scope.XMLHttpRequest) {
    const NativeXHR = scope.XMLHttpRequest;
    scope.XMLHttpRequest = class extends NativeXHR {
      override open(method: string, url: string | URL): void;
      override open(
        method: string,
        url: string | URL,
        asynchronous: boolean,
        username?: string | null,
        password?: string | null,
      ): void;
      override open(
        method: string,
        url: string | URL,
        asynchronous = true,
        username?: string | null,
        password?: string | null,
      ) {
        localAsset(url);
        super.open(method, url, asynchronous, username, password);
      }
    };
  }
  const loadScripts = scope.importScripts.bind(scope);
  scope.importScripts = (...urls) => {
    urls.forEach(localAsset);
    loadScripts(...urls);
  };
  scope.WebSocket = class {
    constructor() {
      throw Error("Rede externa desabilitada no processamento do olhar.");
    }
  };
  scope.EventSource = class {
    constructor() {
      throw Error("Rede externa desabilitada no processamento do olhar.");
    }
  };
}
