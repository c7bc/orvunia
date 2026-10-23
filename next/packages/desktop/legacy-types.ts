export type LegacyVault = {
  seal(value: string): string;
  open(value: string): string;
};
export type LegacyConfig = {
  root: string;
  port: number;
  environment: Record<string, string | undefined>;
  deployment?: { mode: string };
  vault?: LegacyVault;
};
export type LegacyBackend = {
  app: {
    listen(options: { host: string; port: number }): Promise<unknown>;
    close(): Promise<unknown>;
  };
  cookieName: string;
  store: { owner(id: string): unknown; createOwner(): string };
};
export type LegacyCookies = {
  get(options: { url: string; name: string }): Promise<{ value: string }[]>;
  set(options: {
    url: string;
    name: string;
    value: string;
    httpOnly: boolean;
    sameSite: "strict";
    expirationDate: number;
    path: string;
  }): Promise<void>;
};
