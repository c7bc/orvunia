// Adapted from OpenCode Permission.evaluate and Wildcard.match, MIT.
// Copyright (c) 2025 opencode. See assets/licenses/repository-engine.json.
export type AgentPermission = { readonly action: string; readonly resource: string; readonly effect: "allow" | "deny" | "ask" };

function matches(input: string, pattern: string) {
  const normalized = input.replaceAll("\\", "/");
  const escaped = pattern.replaceAll("\\", "/")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp("^" + escaped + "$", "s").test(normalized);
}

export function evaluateAgentPermission(action: string, resource: string, ...rulesets: readonly (readonly AgentPermission[])[]): AgentPermission {
  return rulesets.flat().findLast((rule) => matches(action, rule.action) && matches(resource, rule.resource))
    ?? { action, resource: "*", effect: "ask" };
}

export const repositoryPermissions: readonly AgentPermission[] = Object.freeze([
  { action: "*", resource: "*", effect: "deny" },
  { action: "repository_list", resource: "*", effect: "allow" },
  { action: "repository_read", resource: "*", effect: "allow" },
  { action: "repository_search", resource: "*", effect: "allow" },
].map((rule) => Object.freeze(rule as AgentPermission)));
