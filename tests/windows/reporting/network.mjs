export function installNetworkGuard(application, sessionId) {
  if (!/^[0-9a-f-]{36}$/.test(sessionId)) throw Error("Exact synthetic session required");
  return application.evaluateHandle(({ session, app }, id) => {
    const blocked = [];
    session.defaultSession.webRequest.onBeforeRequest((request, callback) => {
      let allowed = false;
      try {
        const url = new URL(request.url);
        const local = ["http:", "ws:"].includes(url.protocol) && url.hostname === "127.0.0.1" && !url.username && !url.password;
        allowed = ["devtools:", "about:", "data:"].includes(url.protocol) ||
          (local && (["GET", "HEAD"].includes(request.method) ||
            (request.method === "PUT" && url.pathname === "/api/onboarding") ||
            (request.method === "PATCH" && ["/api/sessions/" + id, "/api/sessions/" + id + "/notes"].includes(url.pathname))));
      } catch {}
      callback({ cancel: !allowed });
      if (!allowed) {
        blocked.push({ method: request.method, reason: "Outside synthetic reporting request allowlist" });
        app.exit(2);
      }
    });
    return { blocked, coverage: "after-attach-before-reporting-interaction" };
  }, sessionId);
}
