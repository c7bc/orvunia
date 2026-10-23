export const repositoryLimits = {
  files: 20,
  fileBytes: 8_192,
  totalBytes: 24_576,
  entries: 2_000,
  depth: 8,
  markdownCharacters: 29_000,
} as const;

export type RepositorySkip =
  | "excluded"
  | "unsupported"
  | "linked"
  | "large"
  | "binary"
  | "sensitive"
  | "limit";

export type RepositoryEntry = {
  path: string;
  bytes: number;
  skipped?: RepositorySkip;
};

export type RepositoryFile = {
  path: string;
  bytes: number;
  sha256: string;
  text: string;
  lines: number;
};

export type RepositorySnapshot = {
  version: 1;
  createdAt: string;
  sha256: string;
  scope: string[];
  files: RepositoryFile[];
  bytes: number;
  skipped: Record<RepositorySkip, number>;
};

export type RepositoryReader = {
  scope: readonly string[];
  entries(signal: AbortSignal): AsyncIterable<RepositoryEntry>;
  read(path: string, signal: AbortSignal): Promise<Uint8Array>;
};
