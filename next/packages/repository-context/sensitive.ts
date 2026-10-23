const patterns = [
  /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/,
  /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b/,
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret|token|password|passwd|private[_-]?key|authorization)\b["']?\s*[:=]\s*["'`]([^"'`\r\n]{4,})["'`]/i,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_=-]{12,}/i,
  /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s/:]+:[^\s@]+@/i,
];

export function repositoryContainsSensitiveText(text: string) {
  return patterns.some((pattern) => pattern.test(text));
}

export function decodeRepositoryText(bytes: Uint8Array) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text) ? null : text;
  } catch {
    return null;
  }
}
