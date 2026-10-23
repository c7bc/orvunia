export type CompatibilitySettings = {
  launchAtLogin?: boolean;
  autoAnswer?: boolean;
  autoScreen?: boolean;
  systemAudio?: boolean;
  autoListen?: boolean;
  transcribeMicrophone?: boolean;
  realtime?: boolean;
  protected?: boolean;
  noFocus?: boolean;
  clickthrough?: boolean;
  chunkSeconds?: number;
  opacity?: number;
  theme?: string;
  shortcuts: Record<string, string | undefined>;
};
export type CompatibilityContext = {
  settingsTab: string;
  settings: CompatibilitySettings;
  failedShortcuts: string[];
  preferences: { output: string; audio: string; code: string };
  health: {
    keyConfigured?: boolean;
    keySource?: string;
    models?: { response?: string; transcription?: string };
  };
  profileForm(modal: boolean): string;
  icon(name: string, size?: number): string;
  escape(value: unknown): string;
  toggle(key: string, value: boolean | undefined): string;
  button(label: string, action: string, kind?: string, icon?: string): string;
};
export type ProfileContext = {
  profile: Record<string, string | undefined> | null;
  escape(value: unknown): string;
  button(label: string, action: string, kind?: string, icon?: string): string;
};
export type AgendaContext = {
  agenda: { id?: string; title: string; date: string; mode: string }[];
  escape(value: unknown): string;
  icon(name: string, size?: number): string;
  button(label: string, action: string, kind?: string, icon?: string): string;
  iconButton(name: string, action: string, title: string): string;
  date(value: string): string;
  modeName(mode: string): string;
};
