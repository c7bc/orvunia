export function unusedPersonalPort() {
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: () => new Response(),
  });
  const port = server.port!;
  void server.stop(true);
  return port;
}
export async function startPersonal(
  directory: string,
  client: string,
  port: number,
  secret: string,
) {
  let ready: () => void = () => {};
  const signal = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const child = Bun.spawn([process.execPath, "apps/personal/server.ts"], {
    cwd: new URL("../../", import.meta.url).pathname.replace(
      /^\/(?=[A-Za-z]:)/,
      "",
    ),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      CADENCE_PERSONAL_DIRECTORY: directory,
      CADENCE_CLIENT_DIRECTORY: client,
      PORT: String(port),
      OPENAI_API_KEY: secret,
    },
    ipc(message) {
      if (
        message &&
        typeof message === "object" &&
        "type" in message &&
        message.type === "api_ready"
      )
        ready();
    },
  });
  const output = new Response(child.stdout).text(),
    errors = new Response(child.stderr).text();
  const timeout = setTimeout(() => child.kill(), 15000);
  try {
    await Promise.race([
      signal,
      child.exited.then((code) => {
        throw Error("Personal startup exited: " + code);
      }),
    ]);
    return {
      child,
      output,
      errors,
      async close() {
        if (child.exitCode === null) child.send({ type: "shutdown" });
        const status = await child.exited;
        clearTimeout(timeout);
        return { status, output: await output, errors: await errors };
      },
    };
  } catch (error) {
    child.kill();
    await child.exited;
    clearTimeout(timeout);
    throw error;
  }
}
