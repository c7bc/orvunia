import { z } from "zod";
import type { SecretVault } from "../providers/domain.ts";
export type BackendLaunch = {
  executable: string;
  checksum: string;
  entrypoint: string;
  directory: string;
  port: number;
  environment: Record<string, string>;
  vault?: SecretVault;
  startupMs?: number;
  shutdownMs?: number;
};
export function validateBackendLaunch(options: BackendLaunch) {
  z.number().int().min(1024).max(65535).parse(options.port);
  z.record(
    z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,127}$/),
    z.string().max(60000),
  )
    .refine((value) => Object.keys(value).length <= 256)
    .parse(options.environment);
  if (
    options.environment.CADENCE_DEPLOYMENT !== "local" ||
    options.environment.CADENCE_PUBLIC_URL !==
      `http://127.0.0.1:${options.port}` ||
    options.environment.PORT !== String(options.port)
  )
    throw Error(
      "Desktop backend requires consistent private loopback configuration",
    );
  return options;
}
