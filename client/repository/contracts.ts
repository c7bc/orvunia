export type RepositoryIdentity = { workspaceId: string; actorId: string; sessionId: string };
export type RepositoryBinding = { grantId: string; revision: number; snapshotSha256: string };
export type RepositoryPreview = RepositoryBinding & {
  approved: boolean;
  createdAt: string;
  scope: string[];
  bytes: number;
  files: { path: string; bytes: number; sha256: string; lines: number }[];
  skipped: Record<string, number>;
  markdown?: string;
};
export type RepositoryToolCall = {
  name: "repository_list" | "repository_search" | "repository_read";
  arguments: string;
};
export type RepositoryAgentJob = {
  id: string;
  status: string;
  answer: string | null;
  error: string | null;
  turns: number;
  tools: number;
};
export type RepositoryUserState = {
  identity: RepositoryIdentity | null;
  preview: RepositoryPreview | null;
  question: string;
  job: RepositoryAgentJob | null;
  busy: boolean;
  error: string;
};
