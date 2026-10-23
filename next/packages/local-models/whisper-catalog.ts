import type { ModelManifest } from "./domain.ts";

const revision = "5359861c739e955e79d9a303bcbc70fb988958b1";
const candidates = [
  ["tiny", 77691713, "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21", "F16", 384],
  ["base", 147951465, "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe", "F16", 384],
  ["small-q5_1", 190085487, "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb", "Q5_1", 768],
  ["large-v3-turbo-q5_0", 574041195, "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2", "Q5_0", 1536],
] as const;

export function curatedWhisperModels(): ModelManifest[] {
  return candidates.map(([size, bytes, sha256, quantization, memory]): ModelManifest => ({
    id: `whisper-${size}`, revision, name: `Whisper ${size.replace(/-q5_[01]$/, "")} multilingual ${quantization}`,
    capabilities: ["transcription"], runtime: "whisper.cpp", architecture: "whisper", format: "ggml", quantization,
    license: { name: "MIT", url: "https://github.com/ggml-org/whisper.cpp/blob/master/LICENSE" },
    source: "https://huggingface.co/ggerganov/whisper.cpp", maximumContext: 0, evaluation: "not-verified",
    memory: { calibrated: false, fixedBytes: memory * 1024 ** 2, bytesPerContextToken: 0, visualBytes: 0 },
    files: [{ role: "weights", bytes, sha256, url: `https://huggingface.co/ggerganov/whisper.cpp/resolve/${revision}/ggml-${size}.bin` }],
  }));
}
