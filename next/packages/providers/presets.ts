export const providerPresets = {
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  anthropic: { label: "Anthropic", baseUrl: "https://api.anthropic.com/v1" },
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  ollama: { label: "Ollama", baseUrl: "http://127.0.0.1:11434/v1" },
  compatible: { label: "API compatível", baseUrl: "http://127.0.0.1:8080/v1" },
  deepgram: { label: "Deepgram", baseUrl: "https://api.deepgram.com/v1" },
  assemblyai: { label: "AssemblyAI", baseUrl: "https://api.assemblyai.com/v2" },
} as const;
export const environmentKeys: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  deepgram: "DEEPGRAM_API_KEY",
  assemblyai: "ASSEMBLYAI_API_KEY",
  compatible: "COMPATIBLE_API_KEY",
};
export const canonicalEndpoint = (value: string) =>
  new URL(value).href.replace(/\/+$/, "");
