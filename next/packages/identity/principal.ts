export type Principal = {
  userId: string;
  workspaceId: string;
  locale: "pt-BR" | "en" | "es";
};
export type Identity = { resolve(request: Request): Promise<Principal | null> };
