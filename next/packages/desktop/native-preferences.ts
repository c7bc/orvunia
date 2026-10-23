import type { NativePreferences } from "./preference-types.ts";
import { nativePreferenceUpdate } from "./preference-validation.ts";
import { nativeShortcutDefaults } from "./preference-defaults.ts";

export function createNativePreferences<State>(ports: {
  settings(): NativePreferences;
  commit(settings: NativePreferences): void;
  save(settings: NativePreferences): void;
  register(): void;
  apply(): void;
  tray(): void;
  interactive(): void;
  assertLoginChange?(): void;
  loginSupported(): boolean;
  login(enabled: boolean): void;
  ambient(enabled: boolean): void;
  changed(): void;
  state(): State;
}) {
  return {
    update(value: unknown) {
      const previous = ports.settings(),
        next = nativePreferenceUpdate(previous, value);
      const loginChanged = next.launchAtLogin !== previous.launchAtLogin;
      if (loginChanged) { ports.interactive(); ports.assertLoginChange?.(); }
      const loginSupported = loginChanged && ports.loginSupported();
      if (loginSupported) ports.login(next.launchAtLogin);
      try {
        ports.save(next);
      } catch (error) {
        if (loginSupported) {
          try {
            ports.login(previous.launchAtLogin);
          } catch (rollback) {
            throw new AggregateError(
              [error, rollback],
              "Native preference persistence and login rollback failed",
            );
          }
        }
        throw error;
      }
      ports.commit(next);
      ports.register();
      ports.apply();
      ports.tray();
      if (next.ambientChat !== previous.ambientChat)
        ports.ambient(next.ambientChat);
      ports.changed();
      return ports.state();
    },
    resetShortcut(key: unknown) {
      if (
        typeof key !== "string" ||
        !Object.hasOwn(nativeShortcutDefaults, key)
      )
        throw Error("Atalho inválido.");
      const selected = key as keyof typeof nativeShortcutDefaults;
      const next = {
        ...ports.settings(),
        shortcuts: {
          ...ports.settings().shortcuts,
          [selected]: nativeShortcutDefaults[selected],
        },
      };
      ports.save(next);
      ports.commit(next);
      ports.register();
      ports.changed();
      return ports.state();
    },
  };
}
