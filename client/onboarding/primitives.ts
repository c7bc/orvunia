import { escapeHtml as escape } from "../design/escape.js";
export const locales: [string, string][] = [
  ["pt-BR", "Português"],
  ["en", "English"],
  ["es", "Español"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["ja", "日本語"],
];
export const choices = (values: [string, string][], selected: string) =>
  values
    .map(
      ([value, label]) =>
        `<option value="${escape(value)}" ${value === selected ? "selected" : ""}>${escape(label)}</option>`,
    )
    .join("");
export const lineIcon = (name: string | undefined, size = 20) => {
  const paths: Record<string, string> = {
    search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>',
    student: '<path d="m3 9 9-5 9 5-9 5-9-5Zm4 3v5c3 3 7 3 10 0v-5m4-3v7"/>',
    briefcase:
      '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12c6 3 12 3 18 0m-9 0v4"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><path d="m4 8 5 1 2 4-1 6m10-9-6 1-1-5"/>',
    arrow: '<path d="m9 6 6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pencil: '<path d="m4 16-1 5 5-1L20 8l-4-4L4 16Zm10-10 4 4"/>',
    dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    phone:
      '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
    tablet:
      '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 18h2"/>',
    monitor:
      '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    send: '<path d="m4 4 17 8-17 8 3-8-3-8Zm3 8h14"/>',
    hide: '<path d="m7 14 5-5 5 5"/>',
    code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name ?? ""] || paths.globe}</svg>`;
};
export const industries = [
  "Vendas / GTM",
  "Recrutamento",
  "Finanças",
  "Consultoria",
  "Engenharia",
  "Marketing",
  "Gestão",
  "Jurídico",
  "Design",
  "Produto",
  "Operações",
  "RH",
  "Edição de vídeo",
  "Outro",
];
export const discoverySources = [
  "Google",
  "LinkedIn",
  "YouTube",
  "Email",
  "Twitter / X",
  "TikTok",
  "Instagram",
  "Reddit",
  "Podcast",
  "Indicação",
  "Outro",
];
export const finalOnboardingStep = 6;
