import type { NativePreferences, ShortcutName } from "./preference-types.ts";

export function registerNativeShortcuts(ports: {
  enabled(): boolean;
  settings(): Pick<NativePreferences, "shortcuts">;
  unregisterAll(): void;
  register(accelerator: string, callback: () => void): boolean;
  toggle(): void;
  position(name: string): void;
  clickthrough(): void;
  command(name: ShortcutName): void;
}) {
  const failed: ShortcutName[] = [];
  let registered = 0;
  if (!ports.enabled()) return { failed, registered };
  ports.unregisterAll();
  for (const [name, accelerator] of Object.entries(
    ports.settings().shortcuts,
  ) as [ShortcutName, string][]) {
    try {
      const accepted = ports.register(accelerator, () => {
        if (name === "toggle") ports.toggle();
        else if (
          ["camera", "cursor", "up", "down", "left", "right"].includes(name)
        )
          ports.position(name);
        else if (name === "clickthrough") ports.clickthrough();
        else ports.command(name);
      });
      if (accepted) registered++;
      else failed.push(name);
    } catch {
      failed.push(name);
    }
  }
  return { failed, registered };
}
