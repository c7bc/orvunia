export type Ticket = {
  id: string;
  userId: string;
  workspaceId: string;
  sessionId: string;
  who: "Eu" | "Entrevistador";
  locale: "pt-BR" | "en" | "es";
  historyGeneration: number;
  expiresAt: number;
};
export interface TicketStore {
  put(ticket: Ticket): Promise<void>;
  take(id: string): Promise<Ticket | null>;
}
export interface Peer {
  send(value: unknown): boolean;
  close(code: number): void;
}
export interface Permit {
  renew(): Promise<boolean>;
  release(): Promise<void>;
}
export interface Upstream {
  open(): boolean;
  bufferedBytes(): number;
  send(value: string | Uint8Array): void;
  close(): void;
  opened(callback: () => void): void;
  message(callback: (value: unknown) => void): void;
  ended(callback: () => void): void;
}
export type UpstreamFactory = (
  address: URL,
  headers: Record<string, string>,
) => Upstream;
export class RealtimeError extends Error {
  constructor(
    readonly code:
      | "realtime_unsupported"
      | "realtime_closed"
      | "realtime_limit"
      | "realtime_invalid"
      | "realtime_pending"
      | "realtime_timeout"
      | "realtime_short"
      | "realtime_starting",
    readonly status = 409,
  ) {
    super(code);
  }
}
