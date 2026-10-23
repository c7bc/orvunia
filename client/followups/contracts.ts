export type Draft = {
  recipient: string;
  subject: string;
  body: string;
  revision: number;
  updatedAt: string;
};
export type Delivery = {
  id: string;
  revision: number;
  status: "sending" | "accepted" | "rejected" | "unconfirmed";
  messageId: string;
  date: string;
};
export type FollowupState = {
  draft: Draft | null;
  delivery: Delivery | null;
  sending: {
    configured: boolean;
    allowed: boolean;
    sender: string;
    reason: string;
    dailyLimit: number;
  };
};
export type FollowupPlatform = {
  document: Document;
  storage: Pick<Storage, "getItem" | "removeItem">;
  values(form: HTMLFormElement): Record<string, string>;
  copy(text: string): Promise<void>;
  schedule(callback: () => void, milliseconds: number): () => void;
};
export type FollowupOptions = {
  api(path: string, method?: string, body?: unknown): Promise<unknown>;
  current(): {
    id: string;
    title: string;
    responses: { action: string; text: string }[];
  } | null;
  workspace(): string;
  modal(title: string, content: string): HTMLElement;
  toast(message: string): void;
  identifier(): string;
  platform?: FollowupPlatform;
};
