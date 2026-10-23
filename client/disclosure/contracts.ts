export type Disclosure = {
  details: HTMLDetailsElement;
  summary: HTMLElement;
  body: HTMLDivElement;
  inner: HTMLDivElement;
  target: boolean;
  animation: Animation | null;
  click: (event: MouseEvent) => void;
  toggle: () => void;
};
