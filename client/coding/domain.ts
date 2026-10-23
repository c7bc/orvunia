export type Capture = {
  id: string;
  url: string;
  title?: string;
  time?: string;
};
export type PendingCapture = {
  id: string;
  blob?: Blob;
  name: string;
  preview: string;
  ownsPreview: boolean;
  uploaded: Capture | null;
};
export type CodingDraft = {
  problem: string;
  code: string;
  language: string;
  prefetchTellMore: boolean;
};
export type CodingState = CodingDraft & {
  captures: PendingCapture[];
  flushing: Promise<Capture[]> | null;
  attempt: unknown;
  responseCaptures: Map<string, string[]>;
};
export type WorkspaceOptions = {
  createURL?: (blob: Blob) => string;
  revokeURL?: (url: string) => void;
  maxSessions?: number;
  maxPendingBytes?: number;
  maxResponseRefs?: number;
};
export type Upload = (blob: Blob, name: string, id: string) => Promise<Capture>;
export type UploadProgress = (value: {
  completed: number;
  total: number;
}) => void;
