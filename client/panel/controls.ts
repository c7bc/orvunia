import type { PanelState } from "./state.js";

export const heading = (title: string, sub: string) =>
  `<header class="settings-heading"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</header>`;
export function flowIcon(s: PanelState, name: string, size = 24) {
  const shapes: Record<string, string> = {
    headphones:
      '<path d="M4 13v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="12" width="4" height="8" rx="1.5"/><rect x="17" y="12" width="4" height="8" rx="1.5"/>',
    palette:
      '<path d="M20.5 12a9 9 0 1 0-9 9h1.4a1.8 1.8 0 0 0 1.5-2.8c-.9-1.2-.1-3 1.5-3h1.6a3.4 3.4 0 0 0 3-3.2Z"/><circle cx="7" cy="9" r=".6"/><circle cx="10" cy="6.5" r=".6"/><circle cx="14" cy="6.5" r=".6"/><circle cx="17" cy="9" r=".6"/>',
    store:
      '<path d="M4 10v10h16V10M3 8l2-5h14l2 5M3 8v1a3 3 0 0 0 4 2 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 4-2V8H3Z"/><path d="M9 20v-6h6v6"/>',
    briefcase:
      '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12c6 3 12 3 18 0M10 13h4"/>',
    video:
      '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 9 5-4v14l-5-4"/>',
    graduation:
      '<path d="m2 9 10-5 10 5-10 5L2 9Zm4 2v6c4 3 8 3 12 0v-6M21 10v7"/>',
    book: '<path d="M12 5v16M12 6C9 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2Z"/>',
  };
  return shapes[name]
    ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name]}</svg>`
    : s.icon(name, size);
}
export function setting(
  s: PanelState,
  title: string,
  description: string,
  control: string,
  i = "settings",
) {
  return `<div class="preference-row" data-component="preference-row"><div class="preference-copy"><div class="preference-icon">${flowIcon(s, i, 24)}</div><div><h3>${title}</h3><p>${description}</p></div></div><div class="preference-control">${control.replace(/aria-label="(?:protected|ambientChat|systemAudio|autoListen|transcribeMicrophone|realtime|autoScreen|autoAnswer|noFocus|clickthrough|launchAtLogin)"/g, `aria-label="${s.esc(title)}"`)}</div></div>`;
}
