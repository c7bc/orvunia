import type { CalendarRepository } from "./repository.ts";
import type { SecretVault } from "../providers/domain.ts";
import type { HttpFetch } from "../providers/http.ts";
export type CalendarDependencies = {
  repository: CalendarRepository;
  vault: SecretVault;
  transport: HttpFetch;
  google?: { clientId: string; clientSecret: string };
  origin: string;
  protection: "os" | "file" | "managed";
  clock(): number;
  nonce(): string;
  pause(milliseconds: number): Promise<void>;
};
