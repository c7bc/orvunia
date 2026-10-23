import { RepositoryAgentError } from "./domain.ts";
export const agentLimits = Object.freeze({ turns: 6, tools: 8, bytes: 65_536,
  contextBytes: 131_072, responseBytes: 131_072, outputTokens: 3_000,
  totalTokens: 65_536, lifetimeMilliseconds: 10 * 60_000, callMilliseconds: 65_000 });
export function encodedBytes(value: unknown) { return new TextEncoder().encode(JSON.stringify(value)).length; }
export function agentAssert(condition: unknown, code: string, status = 409): asserts condition {
  if (!condition) throw new RepositoryAgentError(code, status);
}
