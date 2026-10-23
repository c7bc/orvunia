import { Elysia } from "elysia";
import type { ApiDependencies } from "./core-dependencies.ts";
import { publicDeployment } from "../../packages/config/public.ts";
export function publicApiRequest(request: Request) {
  const path = new URL(request.url).pathname;
  return (
    (request.method === "GET" && /^\/api(?:\/v1)?\/deployment\/?$/.test(path))
  );
}
export function publicRoutes(dependencies: ApiDependencies) {
  const info =
    dependencies.publicInfo ??
    publicDeployment(dependencies.deployment ?? "local");
  return new Elysia({ name: "deployment" })
    .get("/api/deployment", () => info)
    .get("/api/v1/deployment", () => info);
}
