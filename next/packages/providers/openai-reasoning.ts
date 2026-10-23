export function openaiReasoning(model: string) {
  if (/^(?:gpt-6\.1-sol|gpt-6-astra)(?:-|$)/u.test(model))
    return { reasoning: { effort: "low" as const } };
  if (/^gpt-6-(?:luna|sol)(?:-|$)/u.test(model))
    return { reasoning: { effort: "none" as const } };
  return {};
}
