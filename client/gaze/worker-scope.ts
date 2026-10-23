export type GazeWorkerScope = {
  location: { href: string; origin: string };
  fetch(input: RequestInfo | URL, options?: RequestInit): Promise<Response>;
  XMLHttpRequest?: typeof XMLHttpRequest;
  importScripts(...urls: (string | URL)[]): void;
  WebSocket: unknown;
  EventSource: unknown;
  onmessage: ((event: MessageEvent<unknown>) => void | Promise<void>) | null;
  postMessage(message: unknown): void;
  close(): void;
};
