export function audioStatusHeight(element: HTMLElement | null, style: (element: HTMLElement) => CSSStyleDeclaration) {
  if (!element) return 0;
  const computed = style(element);
  return element.getBoundingClientRect().height +
    (Number.parseFloat(computed.marginTop) || 0) +
    (Number.parseFloat(computed.marginBottom) || 0);
}
