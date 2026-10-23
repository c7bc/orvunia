import { brandMark } from "./brand";
/** Multicolor provider mark shared by Google connection surfaces. */
export function googleMark(size = 18) {
  return `<svg class="google-provider-mark" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.31.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.38 3.14 1.07 4.51l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>`;
}
const paths: Record<string, string> = {
  info: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6m0-10v.1",
  send: "m3 3 19 9-19 9 4-9-4-9Zm4 9h15",
  orbit:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM4 14c5 1 9-2 11-9M8 20c-1-5 2-10 10-11M4 8c4 4 9 6 16 7",
  spark: "M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z",
  home: "m3 10 9-7 9 7v10H7V11h10v9",
  history: "M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2",
  file: "M14 2H5v20h14V7zM14 2v6h5M8 13h8M8 17h6",
  chat: "M21 11a9 9 0 0 1-9 9H3l1-5a9 9 0 1 1 17-4",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18",
  mic: "M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0zM6 10v2a6 6 0 0 0 12 0v-2M12 18v4m-4 0h8",
  screen: "M3 3h18v13H3zM8 21h8m-4-5v5",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 2h6l1 4 4 1 2 5-3 3 1 4-5 3-3-2-4 1-3-4 1-4-2-3 3-5z",
  shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6zM8 12l3 3 5-6",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  "arrow-up-right": "M5 19 19 5M6 5h13v13",
  plus: "M12 4v16M4 12h16",
  close: "m6 6 12 12M18 6 6 18",
  chevron: "m8 5 7 7-7 7",
  down: "m6 9 6 6 6-6",
  copy: "M8 8h13v13H8zM16 8V3H3v13h5",
  play: "m7 3 14 9-14 9z",
  pause: "M7 4v16M17 4v16",
  stop: "M5 5h14v14H5z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  move: "M12 2v20M2 12h20m-7-7-3-3-3 3m0 14 3 3 3-3M5 9l-3 3 3 3m14 0 3-3-3-3",
  keyboard:
    "M2 5h20v14H2zM6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M7 16h10",
  user: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 22v-3a8 8 0 0 1 16 0v3",
  language: "M3 5h12M9 2v3M5 5s0 8 8 12M13 5S11 13 3 17m11 5 5-11 5 11m-8-4h6",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2",
  search: "M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16m6 14 6 6",
  trash: "M3 5h18M8 5V2h8v3M6 5l1 17h10l1-17M10 9v9m4-9v9",
  download: "M12 2v14m-5-5 5 5 5-5M3 17v5h18v-5",
  attach: "m8 12 8-8a4 4 0 0 1 6 6L10 22a6 6 0 0 1-8-8L14 2m-6 13 8-8",
  check: "m4 12 5 5L20 6",
  volume: "M3 9h4l5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14",
  calendar: "M4 4h16v18H4zM8 2v5m8-5v5M4 10h16",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  cursor: "m4 2 17 12-9 1-4 7z",
  camera: "M3 7h4l2-4h6l2 4h4v14H3zM12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
};
Object.assign(paths, {
  back: "M19 12H5m7-7-7 7 7 7",
  minus: "M5 12h14",
  maximize: "M5 5h14v14H5z",
  refresh:
    "M20 7v5h-5M4 17v-5h5M6 7a8 8 0 0 1 13 0l1 2M4 15l1 2a8 8 0 0 0 13 0",
  modes: "M3 4h7v7H3zM14 4h7v7h-7zM3 15h7v7H3zM14 15h7v7h-7z",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9 8a3 3 0 1 1 5 2c-2 1-2 1-2 4m0 3h.01",
  card: "M2 5h20v14H2zM2 9h20M5 15h5",
  exit: "M10 3H4v18h6M10 12h12m-5-5 5 5-5 5",
  audio: "M4 10v4m4-8v12m4-16v20m4-16v12m4-8v4",
  "eye-off":
    "m3 3 18 18M10 5h2c7 0 10 7 10 7a18 18 0 0 1-3 4M6 6a18 18 0 0 0-4 6s4 7 10 7c2 0 4-.5 5-1M10 10a3 3 0 0 0 4 4",
  "arrow-up": "M12 20V4m-6 6 6-6 6 6",
});
const referenceSolidPaths: Record<string, string[]> = {
  settings: [
    "M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  ],
  card: [
    "M2.5 4A1.5 1.5 0 0 0 1 5.5V6h18v-.5A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1v6A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5v-6ZM3 13.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm4.75-.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z",
  ],
  file: [
    "M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z",
  ],
  shield: [
    "M8 7a5 5 0 1 1 3.61 4.804l-1.903 1.903A1 1 0 0 1 9 14H8v1a1 1 0 0 1-1 1H6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 .293-.707L8.196 8.39A5.002 5.002 0 0 1 8 7Zm5-3a.75.75 0 0 0 0 1.5A1.5 1.5 0 0 1 14.5 7 .75.75 0 0 0 16 7a3 3 0 0 0-3-3Z",
  ],
  language: [
    "M7.75 2.75a.75.75 0 0 0-1.5 0v1.258a32.987 32.987 0 0 0-3.599.278.75.75 0 1 0 .198 1.487A31.545 31.545 0 0 1 8.7 5.545 19.381 19.381 0 0 1 7 9.56a19.418 19.418 0 0 1-1.002-2.05.75.75 0 0 0-1.384.577 20.935 20.935 0 0 0 1.492 2.91 19.613 19.613 0 0 1-3.828 4.154.75.75 0 1 0 .945 1.164A21.116 21.116 0 0 0 7 12.331c.095.132.192.262.29.391a.75.75 0 0 0 1.194-.91c-.204-.266-.4-.538-.59-.815a20.888 20.888 0 0 0 2.333-5.332c.31.031.618.068.924.108a.75.75 0 0 0 .198-1.487 32.832 32.832 0 0 0-3.599-.278V2.75Z",
    "M13 8a.75.75 0 0 1 .671.415l4.25 8.5a.75.75 0 1 1-1.342.67L15.787 16h-5.573l-.793 1.585a.75.75 0 1 1-1.342-.67l4.25-8.5A.75.75 0 0 1 13 8Zm2.037 6.5L13 10.427 10.964 14.5h4.073Z",
  ],
  help: [
    "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.94 6.94a.75.75 0 1 1-1.061-1.061 3 3 0 1 1 2.871 5.026v.345a.75.75 0 0 1-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 1 0 8.94 6.94ZM10 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  ],
  user: [
    "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5.5-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a5.99 5.99 0 0 0-4.793 2.39A6.483 6.483 0 0 0 10 16.5a6.483 6.483 0 0 0 4.793-2.11A5.99 5.99 0 0 0 10 12Z",
  ],
};
// Independent geometric glyphs for observed component roles.
const geometricGlyphs: Record<string, { viewBox: string; shape: string }> = {
  "stop-solid": {
    viewBox: "0 0 24 24",
    shape: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  },
  "play-solid": {
    viewBox: "0 0 24 24",
    shape:
      '<path d="M7 3.8a1 1 0 0 1 1.5-.86l13 8.2a1 1 0 0 1 0 1.72l-13 8.2A1 1 0 0 1 7 20.2Z"/>',
  },
  "folder-solid": {
    viewBox: "0 0 20 20",
    shape:
      '<path d="M3 3h5l2 2h6a1 1 0 0 1 1 1v2H3V3Zm0 6h14l-2 8H4L2 11a1.5 1.5 0 0 1 1-2Z"/>',
  },
  "lifebuoy-solid": {
    viewBox: "0 0 20 20",
    shape:
      '<path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0ZM13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-1.5 0a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z"/><path d="m4 4 3.8 2.6-1.2 1.2L4 4Zm12 0-2.6 3.8-1.2-1.2L16 4ZM4 16l2.6-3.8 1.2 1.2L4 16Zm12 0-3.8-2.6 1.2-1.2L16 16Z"/>',
  },
  "frown-solid": {
    viewBox: "0 0 20 20",
    shape:
      '<path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM7 7h2v3H7V7Zm4 0h2v3h-2V7Zm-4.8 7.5Q10 10.5 13.8 14.5l-1.1.9Q10 12.6 7.3 15.4l-1.1-.9Z"/>',
  },
  "mode-templates-solid": {
    viewBox: "0 0 20 20",
    shape:
      '<rect x="2" y="2" width="7" height="7" rx="2"/><rect x="11" y="2" width="7" height="7" rx="2"/><rect x="2" y="11" width="7" height="7" rx="2"/><rect x="11" y="11" width="7" height="7" rx="2"/>',
  },
  dots: {
    viewBox: "0 0 24 24",
    shape:
      '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  },
};
export const icon = (name: string, size = 20) =>
  name === "orbit" ? brandMark(size) :
  geometricGlyphs[name]
    ? `<svg width="${size}" height="${size}" viewBox="${geometricGlyphs[name].viewBox}" fill="currentColor" aria-hidden="true">${geometricGlyphs[name].shape}</svg>`
    : name.endsWith("-solid") && referenceSolidPaths[name.slice(0, -6)]
      ? `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">${referenceSolidPaths[name.slice(0, -6)]!.map((d) => `<path fill-rule="evenodd" clip-rule="evenodd" d="${d}"/>`).join("")}</svg>`
      : `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`;
