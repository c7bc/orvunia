import type { RepositorySkip } from "./domain.ts";

const directories = new Set([
  "node_modules", "vendor", "dist", "build", "coverage", "target", "venv",
  "__pycache__", "secrets", "credentials", "private", "certificates", "logs",
]);
const extensions = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "mts", "cts", "py", "go", "rs",
  "java", "kt", "cs", "cpp", "hpp", "h", "c", "rb", "php", "swift", "sql",
  "md", "txt", "json", "css", "scss", "html", "vue", "svelte", "graphql",
  "proto", "yaml", "yml", "toml",
]);

export function normalizeRepositoryScope(value: string) {
  const path = value.replaceAll("\\", "/").replace(/\/$/, "");
  if (!path || path.length > 240 || path.split("/").some((part) =>
    !part || part === "." || part === ".." || /[\x00-\x1f\x7f:*?<>|]/.test(part)))
    throw Error("repository_scope_invalid");
  return path;
}

export function repositoryPathPolicy(path: string, directory: boolean): RepositorySkip | null {
  const parts = path.toLowerCase().split("/"), name = parts.at(-1) ?? "";
  if (parts.some((part) => part.startsWith(".") || directories.has(part)))
    return "excluded";
  if (/(?:^|[._-])(?:secret|secrets|credential|credentials|token|tokens|password|passwords|private-key)(?:[._-]|$)/.test(name)
    || /^(?:id_rsa|id_ed25519|authorized_keys|known_hosts|package-lock\.json|bun\.lock|yarn\.lock|pnpm-lock\.yaml)$/.test(name)
    || /\.(?:pem|key|p12|pfx|crt|cer|keystore|sqlite|db)(?:\.|$)/.test(name))
    return "excluded";
  if (directory) return null;
  const extension = name.split(".").at(-1) ?? "";
  return extensions.has(extension) ? null : "unsupported";
}

export function insideRepositoryScope(path: string, scope: readonly string[]) {
  return scope.some((allowed) => path === allowed || path.startsWith(allowed + "/"));
}

export function repositoryDirectoryNeeded(path: string, scope: readonly string[]) {
  return insideRepositoryScope(path, scope)
    || scope.some((allowed) => allowed.startsWith(path + "/"));
}
