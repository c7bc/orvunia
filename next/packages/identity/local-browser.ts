import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

type Client = (request: Request) => Promise<Response | null>;
export function localBrowserSession(origin: string) {
  const url = new URL(origin);
  if (url.origin !== origin || url.hostname !== "127.0.0.1")
    throw Error("Local browser sessions require a loopback origin");
  const name =
    "cadence_local_" +
    createHash("sha256").update(origin).digest("hex").slice(0, 12);
  const secret = randomBytes(32).toString("base64url");
  const expected = createHash("sha256").update(secret).digest();
  let closed = false;
  function sameOrigin(request: Request) {
    const supplied = request.headers.get("origin");
    return (
      new URL(request.url).origin === origin &&
      (!supplied || supplied === origin)
    );
  }
  function authorize(request: Request) {
    const site = request.headers.get("sec-fetch-site");
    const socket =
      request.method === "GET" &&
      request.headers.get("upgrade")?.toLowerCase() === "websocket" &&
      request.headers.get("origin") === origin;
    if (
      closed ||
      !sameOrigin(request) ||
      (site !== "same-origin" && !(site === null && socket))
    )
      return false;
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers.get("origin") !== origin
    )
      return false;
    const values = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((value) => value.trim())
      .filter((value) => value.startsWith(name + "="));
    if (values.length !== 1) return false;
    const actual = createHash("sha256")
      .update(values[0]!.slice(name.length + 1))
      .digest();
    return timingSafeEqual(actual, expected);
  }
  function wrap(client: Client): Client {
    return async (request) => {
      const response = await client(request);
      if (
        !response ||
        closed ||
        !sameOrigin(request) ||
        request.method !== "GET" ||
        response.status !== 200 ||
        !response.headers.get("content-type")?.startsWith("text/html")
      )
        return response;
      const site = request.headers.get("sec-fetch-site");
      if (
        request.headers.get("sec-fetch-mode") !== "navigate" ||
        request.headers.get("sec-fetch-dest") !== "document" ||
        (site !== "none" && site !== "same-origin")
      )
        return response;
      const headers = new Headers(response.headers);
      headers.append(
        "set-cookie",
        `${name}=${secret}; Path=/; HttpOnly; SameSite=Strict${url.protocol === "https:" ? "; Secure" : ""}`,
      );
      return new Response(response.body, { status: response.status, headers });
    };
  }
  return {
    authorize,
    wrap,
    close() {
      closed = true;
    },
  };
}
