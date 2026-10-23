export function auxiliarySnapshot(document: Document, identify: (node: Element) => string) {
  const modal = document.querySelector("#dialogs > .modal-backdrop");
  const menu = document.querySelector('.overlay-menu:not([aria-hidden="true"]):not([data-overlay-exit])');
  const popups = [...document.querySelectorAll('.flow-select-popup:not([aria-hidden="true"])')];
  const roots = [...(modal ? [modal] : menu ? [menu] : []), ...popups];
  const kind = modal ? "modal" : menu ? "menu" : "select";
  const html = roots.map(root => {
    const clone = root.cloneNode(true) as Element;
    const originals = [root, ...root.querySelectorAll("*")];
    const copies = [clone, ...clone.querySelectorAll("*")];
    originals.forEach((node, index) => {
      const copy = copies[index]!;
      copy.setAttribute("data-auxiliary-id", identify(node));
      if (node.tagName === "INPUT") {
        const field = node as HTMLInputElement;
        copy.setAttribute("value", field.value);
        copy.toggleAttribute("checked", field.checked);
      }
      if (node.tagName === "TEXTAREA") copy.textContent = (node as HTMLTextAreaElement).value;
      if (node.tagName === "OPTION") copy.toggleAttribute("selected", (node as HTMLOptionElement).selected);
      for (const attribute of [...copy.attributes])
        if (/^on/i.test(attribute.name) || attribute.name === "srcdoc") copy.removeAttribute(attribute.name);
    });
    for (const element of clone.querySelectorAll("script,iframe,object,embed,link,style,base,meta")) element.remove();
    for (const element of clone.querySelectorAll("[src],[href],[action],[formaction]")) {
      for (const name of ["src", "href", "action", "formaction"]) {
        const value = element.getAttribute(name);
        if (!value) continue;
        try {
          const url = new URL(value, document.baseURI);
          if (url.origin !== new URL(document.baseURI).origin && !/^data:image\/(png|jpeg|webp);base64,/.test(value))
            element.removeAttribute(name);
        } catch { element.removeAttribute(name); }
      }
    }
    return `<div data-auxiliary-layer="${root.classList.contains("flow-select-popup") ? "select" : kind}">${clone.outerHTML}</div>`;
  }).join("");
  return { roots, html, kind } as const;
}
