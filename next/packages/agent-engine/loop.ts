// Adapted from Pi runLoop, MIT, Copyright (c) 2025 Mario Zechner.
// Pinned source and modifications: assets/licenses/repository-engine.json.
export interface AgentLoopState {
  readonly status: string;
  readonly turns: number;
  readonly tools: number;
}

export interface AgentLoopPorts<State extends AgentLoopState> {
  advance(state: State, signal: AbortSignal): Promise<State>;
  executeTools(state: State, signal: AbortSignal): Promise<State>;
  changed(state: State): void;
}

export const terminalAgentStates = ["completed", "cancelled", "failed", "unknown"] as const;

/** Runs durable steps; a remote tool boundary replaces Pi's in-process tool execution. */
export async function runAgentLoop<State extends AgentLoopState>(
  initial: State,
  ports: AgentLoopPorts<State>,
  signal: AbortSignal,
  maximumTransitions: number,
): Promise<State> {
  if (!Number.isSafeInteger(maximumTransitions) || maximumTransitions < 1)
    throw Error("repository_agent_limit");
  let current = initial;
  ports.changed(current);
  for (let transition = 0; transition < maximumTransitions; transition++) {
    signal.throwIfAborted();
    if (terminalAgentStates.some((status) => status === current.status)) return current;
    const previous = current;
    if (current.status === "ready") current = await ports.advance(current, signal);
    else if (current.status === "waiting_tools") current = await ports.executeTools(current, signal);
    else throw Error("repository_agent_busy");
    signal.throwIfAborted();
    ports.changed(current);
    if (current.status === previous.status && current.turns === previous.turns && current.tools === previous.tools)
      throw Error("repository_agent_no_progress");
  }
  if (terminalAgentStates.some((status) => status === current.status)) return current;
  throw Error("repository_agent_limit");
}
