import type { CommandContext } from "./ports.js";
export function optional(
  context: CommandContext,
  selector: string,
): HTMLElement | null {
  return context.ports.document.querySelector<HTMLElement>(selector);
}
export function element(
  context: CommandContext,
  selector: string,
): HTMLElement {
  const value = optional(context, selector);
  if (!value)
    throw Error("Esta tela não está mais disponível. Abra-a novamente.");
  return value;
}
export function field(
  context: CommandContext,
  selector: string,
): HTMLInputElement {
  return element(context, selector) as HTMLInputElement;
}
export function fieldValue(
  context: CommandContext,
  selector: string,
): string | undefined {
  return optional(context, selector)
    ? field(context, selector).value
    : undefined;
}
export function elements(
  context: CommandContext,
  selector: string,
  root?: ParentNode | null,
): HTMLElement[] {
  return [
    ...(root ?? context.ports.document).querySelectorAll<HTMLElement>(selector),
  ];
}
