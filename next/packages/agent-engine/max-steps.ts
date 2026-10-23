// Adapted from OpenCode MAX_STEPS_PROMPT, MIT, Copyright (c) 2025 opencode.
// See assets/licenses/repository-engine.json for pinned source and modifications.
export const maximumStepsInstructions = `The tool budget for this turn is exhausted. Use the returned evidence to answer the current request without more tool calls.
When the evidence is sufficient, deliver the requested answer rather than a tool-budget or unfinished-work report.
Mention an evidence gap only if it prevents a requested conclusion or action. Then give a concrete useful next step.
Do not claim reads, edits, test execution or observed results without corresponding evidence. Explaining existing code or showing a test does not itself require test execution.`;
