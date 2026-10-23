import { createHash } from "node:crypto";
import type { ResponseConnection } from "../providers/domain.ts";
import { repositoryAgentInstructions, repositoryToolDefinitions } from "./definitions.ts";

export function repositoryModelFingerprint(connection: ResponseConnection, presentation: string,
  instructions = repositoryAgentInstructions, tools = repositoryToolDefinitions) {
  return createHash("sha256").update(JSON.stringify({ version: "orvunia-repository-model/3-pi-opencode",
    provider: connection.provider, baseUrl: connection.baseUrl.replace(/\/$/, ""), model: connection.model,
    presentation, instructions, tools,
  })).digest("hex");
}
