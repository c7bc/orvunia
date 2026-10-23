export type LifecycleSession = {
  id: string;
  mode: "recruiter" | "technical";
  state: string;
  elapsed: number;
};
export type LifecycleState<Session> = {
  current: Session | null;
  sessions: Session[];
  started: number;
  elapsedBase: number;
  draft: string;
  tab: string;
  view: string;
  page: string;
  audioStatus: { microphone: string; system: string };
};
export type LifecyclePorts<Session extends LifecycleSession> = {
  state: LifecycleState<Session>;
  workspace(): string;
  clock(): number;
  duration(): number;
  base(modeId: string): LifecycleSession["mode"];
  request(
    path: string,
    method: string,
    body: object | undefined,
    signal: AbortSignal,
  ): Promise<Session>;
  native: {
    begin(session: Pick<LifecycleSession, "id" | "mode">): Promise<unknown>;
    end(): Promise<unknown>;
  } | null;
  audio: { stop(): Promise<unknown> };
  stopGaze(): void;
  cancelAnswer(): void;
  ambientChat(): boolean;
  replaceURL(url: string): void;
  closeModal(): void;
  render(): void;
  opened?(sessionId: string): Promise<unknown>;
  detail(session: Session): void;
  sync(): Promise<void>;
  broadcast(message: { type: string; action?: string }): void;
};
