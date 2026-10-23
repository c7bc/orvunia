import { LocalModelError, type Capability, type DownloadJob, type Installation, type ModelFile, type ModelManifest } from "./domain.ts";
import { curatedWhisperModels } from "./whisper-catalog.ts";

function file(repo: string, revision: string, filename: string, bytes: number, sha256: string, role: ModelFile["role"] = "weights"): ModelFile {
  return { role, bytes, sha256, url: `https://huggingface.co/${repo}/resolve/${revision}/${filename}` };
}
const qwenRevision = "23749fefcc72300e3a2ad315e1317431b06b590a";
const smolRevision = "b9e4379657e1450d04d02eec8e345667265b0a00";
const qwenVisionRevision = "6ab461498e2023f6e3c1baea90a8f0fe38ab64d0";
const apache = { name: "Apache-2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" };
const manifestList: ModelManifest[] = ([
  {
    id: "qwen3.5-0.8b-q4", revision: qwenVisionRevision, name: "Qwen3.5 0.8B Q4", capabilities: ["text", "vision"],
    runtime: "llama.cpp", architecture: "qwen3.5", format: "gguf", quantization: "Q4_K_M", license: apache,
    source: "https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF", maximumContext: 4096, evaluation: "not-verified",
    memory: { calibrated: false, fixedBytes: 512 * 1024 ** 2, bytesPerContextToken: 32768, visualBytes: 384 * 1024 ** 2 },
    files: [
      file("unsloth/Qwen3.5-0.8B-GGUF", qwenVisionRevision, "Qwen3.5-0.8B-Q4_K_M.gguf", 532517120,
        "bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517"),
      file("unsloth/Qwen3.5-0.8B-GGUF", qwenVisionRevision, "mmproj-F16.gguf", 204987232,
        "56e4c6cfe73b0c82e3e82bc518d7591997e61d81f723fc41a586f4fa69ea2453", "projector"),
    ],
  },
  {
    id: "qwen3-0.6b-q8", revision: qwenRevision, name: "Qwen3 0.6B Q8", capabilities: ["text"],
    runtime: "llama.cpp", architecture: "qwen3", format: "gguf", quantization: "Q8_0", license: apache,
    source: "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF", maximumContext: 4096, evaluation: "not-verified",
    memory: { calibrated: false, fixedBytes: 512 * 1024 ** 2, bytesPerContextToken: 32768, visualBytes: 0 },
    files: [file("Qwen/Qwen3-0.6B-GGUF", qwenRevision, "Qwen3-0.6B-Q8_0.gguf", 639446688,
      "9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031")],
  },
  {
    id: "smolvlm-256m-q8", revision: smolRevision, name: "SmolVLM 256M Q8", capabilities: ["text", "vision"],
    runtime: "llama.cpp", architecture: "smolvlm", format: "gguf", quantization: "Q8_0", license: apache,
    source: "https://huggingface.co/ggml-org/SmolVLM-256M-Instruct-GGUF", maximumContext: 2048, evaluation: "not-verified",
    memory: { calibrated: false, fixedBytes: 384 * 1024 ** 2, bytesPerContextToken: 32768, visualBytes: 256 * 1024 ** 2 },
    files: [
      file("ggml-org/SmolVLM-256M-Instruct-GGUF", smolRevision, "SmolVLM-256M-Instruct-Q8_0.gguf", 175054528,
        "2a31195d3769c0b0fd0a4906201666108834848db768af11de1d2cef7cd35e65"),
      file("ggml-org/SmolVLM-256M-Instruct-GGUF", smolRevision, "mmproj-SmolVLM-256M-Instruct-Q8_0.gguf", 103769856,
        "7e943f7c53f0382a6fc41b6ee0c2def63ba4fded9ab8ed039cc9e2ab905e0edd", "projector"),
    ],
  },
  ...curatedWhisperModels(),
] satisfies ModelManifest[]).map((manifest) => ({ ...manifest, availability: "retired" }));

export class CuratedCatalog {
  constructor(private readonly manifests: readonly ModelManifest[] = manifestList) {}
  list(capability?: Capability): ModelManifest[] {
    return structuredClone(this.manifests.filter((entry) => !capability || entry.capabilities.includes(capability)));
  }
  listAvailable(capability?: Capability): ModelManifest[] {
    return this.list(capability).filter((manifest) => manifest.availability !== "retired");
  }
  listVisible(installations: readonly Pick<Installation, "catalogId" | "catalogRevision" | "state">[],
    jobs: readonly Pick<DownloadJob, "catalogId" | "catalogRevision" | "state">[] = []): ModelManifest[] {
    return this.list().filter((manifest) => manifest.availability !== "retired" || installations.some((installation) =>
      installation.state !== "deleted" && installation.catalogId === manifest.id && installation.catalogRevision === manifest.revision) ||
      jobs.some((job) => ["queued", "downloading", "verifying"].includes(job.state) &&
        job.catalogId === manifest.id && job.catalogRevision === manifest.revision));
  }
  acquire(id: string, revision: string): ModelManifest {
    const manifest = this.find(id, revision);
    if (manifest.availability === "retired") throw new LocalModelError("model_retired", 409);
    return manifest;
  }
  find(id: string, revision: string): ModelManifest {
    const manifest = this.manifests.find((entry) => entry.id === id && entry.revision === revision);
    if (!manifest) throw new LocalModelError("catalog_revision_unavailable", 404);
    return structuredClone(manifest);
  }
}
