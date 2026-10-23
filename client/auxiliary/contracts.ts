export type AuxiliaryInteraction = {
  action: "interact";
  documentId: string;
  revision: number;
  type: "click" | "input" | "change" | "keydown" | "submit" | "dismiss";
  target?: string;
  value?: string;
  checked?: boolean;
  key?: string;
  shift?: boolean;
  control?: boolean;
};
export type AuxiliaryPublication = {
  action: "publish";
  documentId: string;
  revision: number;
  html: string;
  kind: "menu" | "modal" | "select";
  theme: "dark" | "light";
  locale: "pt-BR" | "en" | "es";
};
export type AuxiliaryTransport = {
  invoke(value: unknown): Promise<unknown>;
  onEvent(callback: (value: unknown) => void): () => void;
};
