import type { Disclosure } from "./contracts.js";
export function cancelDisclosure(record: Disclosure) {
  const animation = record.animation;
  record.animation = null;
  animation?.cancel();
}
export function settleDisclosure(record: Disclosure, open: boolean) {
  cancelDisclosure(record);
  record.target = open;
  record.details.open = open;
  record.body.inert = !open;
  record.summary.setAttribute("aria-expanded", String(open));
  record.details.dataset.disclosureOpen = String(open);
}
export function disclosureTransition(
  document: Document,
  window: Window,
  reduced: () => boolean,
) {
  return (record: Disclosure, open: boolean) => {
    const { details, summary, body } = record;
    const from = details.open ? body.getBoundingClientRect().height : 0;
    const opacity = details.open ? window.getComputedStyle(body).opacity : 0;
    cancelDisclosure(record);
    record.target = open;
    summary.setAttribute("aria-expanded", String(open));
    details.dataset.disclosureOpen = String(open);
    if (!open && body.contains(document.activeElement))
      summary.focus({ preventScroll: true });
    body.inert = !open;
    if (reduced() || !body.animate) return settleDisclosure(record, open);
    details.open = true;
    const animation = body.animate(
      [
        { height: `${from}px`, opacity: from === 0 ? 0 : opacity },
        { height: `${open ? body.scrollHeight : 0}px`, opacity: open ? 1 : 0 },
      ],
      {
        duration: open ? 240 : 180,
        easing: "cubic-bezier(.2,0,0,1)",
        fill: "both",
      },
    );
    record.animation = animation;
    animation.finished.then(
      () => {
        if (record.animation === animation) settleDisclosure(record, open);
      },
      () => {},
    );
  };
}
