import { createServer } from "node:net";
function available(port: number) {
  return new Promise<boolean>((resolve, reject) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") resolve(false);
      else reject(error);
    });
    server.listen({ host: "127.0.0.1", port }, () =>
      server.close((error) => (error ? reject(error) : resolve(true))),
    );
  });
}
export async function desktopPort(first = 8790, end = 8810) {
  if (
    !Number.isInteger(first) ||
    !Number.isInteger(end) ||
    first < 1024 ||
    end > 65536 ||
    end <= first
  )
    throw Error("Invalid desktop port range");
  for (let port = first; port < end; port++)
    if (await available(port)) return port;
  throw Error("Nenhuma porta local disponível.");
}
