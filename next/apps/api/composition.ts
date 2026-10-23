import type { LogEvent } from "./core-dependencies.ts";
import type { SecretVault } from "../../packages/providers/domain.ts";
import type { HttpFetch } from "../../packages/providers/http.ts";

export type CompositionOptions = {
  selectResponseModel?: import("../../packages/answers/dependencies.ts").AnswerDependencies["selectResponseModel"];
  clientDirectory?: string;
  clientVendorDirectory?: string;
  upstream?: import("../../packages/realtime/domain.ts").UpstreamFactory;
  environment?: Record<string, string | undefined>;
  vault?: SecretVault;
  transport?: HttpFetch;
  log?: (event: LogEvent) => void;
};
export type Composition = {
  selectResponseModel?: import("../../packages/answers/dependencies.ts").AnswerDependencies["selectResponseModel"];
  clientDirectory?: string;
  clientVendorDirectory?: string;
  upstream?: import("../../packages/realtime/domain.ts").UpstreamFactory;
  environment: Record<string, string | undefined>;
  vault?: SecretVault;
  transport: HttpFetch;
  log(event: LogEvent): void;
};
