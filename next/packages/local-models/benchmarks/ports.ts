import type { BenchmarkJob } from "./types.ts";

export interface BenchmarkStore {
  find(actor: string, id: string): BenchmarkJob | null;
  findRequest(actor: string, requestId: string): BenchmarkJob | null;
  list(actor: string, installationId: string): BenchmarkJob[];
  create(actor: string, job: BenchmarkJob): void;
  replace(job: BenchmarkJob): void;
  interrupt(now: number): void;
}
