export type Capability = "text" | "vision" | "transcription";
export type RuntimeKind = "llama.cpp" | "whisper.cpp";
export type ModelFile = {
  role: "weights" | "projector";
  bytes: number;
  sha256: string;
  url: string;
};
export type ModelManifest = {
  id: string;
  revision: string;
  name: string;
  capabilities: Capability[];
  runtime: RuntimeKind;
  architecture: string;
  format: "gguf" | "ggml";
  quantization: string;
  license: { name: string; url: string };
  source: string;
  files: ModelFile[];
  maximumContext: number;
  evaluation: "not-verified" | "verified";
  availability?: "retired";
  memory: {
    calibrated: boolean;
    fixedBytes: number;
    bytesPerContextToken: number;
    visualBytes: number;
  };
};
export type HardwareSnapshot = {
  measuredAt: string;
  architecture: string;
  processors: number;
  totalMemoryBytes: number;
  availableMemoryBytes: number;
  freeDiskBytes: number | null;
  acceleration: "cpu" | "cuda" | "metal" | "vulkan";
  unavailableFields: string[];
};
export type CompatibilityRequest = {
  contextTokens: number;
  enabledCapabilities: Capability[];
  simultaneousMemoryBytes: number;
};
export type Compatibility = {
  verdict: "recommended" | "may-be-slow" | "incompatible" | "not-verified";
  reasonCodes: string[];
  estimatedMemoryBytes: number;
  requiredDiskBytes: number;
};
export type JobState = "queued" | "downloading" | "verifying" | "installed" | "cancelled" | "failed";
export type DownloadJob = {
  id: string;
  installationId: string;
  requestId: string;
  fingerprint: string;
  catalogId: string;
  catalogRevision: string;
  state: JobState;
  bytesDone: number;
  bytesTotal: number;
  progressRevision: number;
  errorCode: string | null;
  retryable: boolean;
  etags: Record<string, string>;
};
export type Installation = {
  id: string;
  catalogId: string;
  catalogRevision: string;
  revision: number;
  state: "installed" | "deleting" | "deleted" | "failed-cleanup";
  files: { role: ModelFile["role"]; sha256: string; bytes: number }[];
  removal?: { requestId: string; expectedRevision: number };
};
export type ModelRemoval = { requestId: string; installationId: string; expectedRevision: number;
  state: "running" | "completed" | "failed"; lease: string; leaseUntil: number };
export class LocalModelError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}
