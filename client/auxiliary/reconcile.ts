function key(node: Node) {
  return node.nodeType === 1 ? (node as Element).getAttribute("data-auxiliary-id") : null;
}
function compatible(current: Node, next: Node) {
  return current.nodeType === next.nodeType && (current.nodeType !== 1 || (
    (current as Element).tagName === (next as Element).tagName
    && (current as Element).namespaceURI === (next as Element).namespaceURI));
}
function attributes(current: Element, next: Element) {
  for (const attribute of [...current.attributes])
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  for (const attribute of [...next.attributes])
    if (current.getAttribute(attribute.name) !== attribute.value)
      current.setAttribute(attribute.name, attribute.value);
}
function children(current: Node, next: Node) {
  const available = [...current.childNodes];
  for (const [index, incoming] of [...next.childNodes].entries()) {
    const identity = key(incoming);
    const existing = available.find(node => key(node) === identity && compatible(node, incoming));
    if (!existing) {
      current.insertBefore(incoming.cloneNode(true), current.childNodes[index] ?? null);
      continue;
    }
    available.splice(available.indexOf(existing), 1);
    if (current.childNodes[index] !== existing)
      current.insertBefore(existing, current.childNodes[index] ?? null);
    if (existing.nodeType === 1) {
      attributes(existing as Element, incoming as Element);
      children(existing, incoming);
      const element = existing as HTMLInputElement;
      if (element.tagName === "INPUT") {
        if (element.type !== "file") element.value = (incoming as Element).getAttribute("value") ?? "";
        element.checked = (incoming as Element).hasAttribute("checked");
      } else if (element.tagName === "TEXTAREA") element.value = incoming.textContent ?? "";
      else if (element.tagName === "OPTION")
        (existing as HTMLOptionElement).selected = (incoming as Element).hasAttribute("selected");
    } else if (existing.nodeValue !== incoming.nodeValue) existing.nodeValue = incoming.nodeValue;
  }
  for (const node of available) current.removeChild(node);
}
export function reconcileAuxiliaryContent(host: HTMLElement, html: string) {
  const template = host.ownerDocument.createElement("template");
  template.innerHTML = html;
  children(host, template.content);
}
