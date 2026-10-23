import { expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { renderGeneralSettings } from "../../../client/panel/general.ts";
import { renderCompatibilitySettings } from "../../../client/panel/compatibility-settings.ts";
import { platformMessages } from "../../../client/platform/messages.ts";
import { applicationDesktop } from "../../../client/application/desktop-state.ts";
import { runSystemCommands } from "../../../client/commands/system.ts";
import type { PanelState } from "../../../client/panel/state.ts";
import type { CompatibilityContext } from "../../../client/panel/compatibility-types.ts";
import type { CommandContext } from "../../../client/commands/ports.ts";
const distribution = { channel: "msix", updates: "windows-store", startup: "windows-settings" } as const;
const escape = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const button = (text: string, action: string) => `<button data-action="${action}">${escape(text)}</button>`;
const toggle = (key: string) => `<button data-setting="${key}"></button>`;

for (const locale of ["en", "pt-BR", "es"])
test(`MSIX settings use honest Windows controls in ${locale} without altering standalone settings`, () => {
  const base = { uiLocale: locale, esc: escape, button, toggle, icon: () => "", desktop: { settings: { shortcuts: {} }, distribution } };
  const dom = parseHTML(renderGeneralSettings(base as unknown as PanelState)).document;
  expect(dom.querySelector("[data-setting=launchAtLogin]")).toBeNull();
  expect(dom.querySelector("[data-action=manage-startup]")?.textContent).toBe(platformMessages(locale).manage);
  expect(dom.querySelector("[data-action=check-updates]")?.textContent).toBe(platformMessages(locale).updates);
  expect(dom.body.textContent || dom.toString()).not.toContain("Startup is enabled");
  const normal = renderGeneralSettings({ ...base, desktop: { settings: { shortcuts: {} } } } as unknown as PanelState);
  expect(normal).toContain('data-setting="launchAtLogin"'); expect(normal).toContain("Verificar atualizações");
  const compatibility = { distribution, uiLocale: locale, settingsTab: "general", settings: {}, preferences: {}, health: {},
    escape, button, toggle, icon: () => "", profileForm: () => "" } as unknown as CompatibilityContext;
  const fallback = renderCompatibilitySettings(compatibility)!;
  expect(fallback).toContain("manage-startup"); expect(fallback).not.toContain('data-setting="launchAtLogin"');
});

test("snapshot decoder preserves coherent management and refuses incompatible capabilities", () => {
  const base = { settings: { shortcuts: {} }, failedShortcuts: [] };
  expect(applicationDesktop({ ...base, distribution }).distribution).toEqual(distribution);
  expect(applicationDesktop(base).distribution).toBeUndefined();
  expect(() => applicationDesktop({ ...base, distribution: { ...distribution, updates: "release" } })).toThrow();
});

test("managed UI actions bypass release feed while normal check retains existing flow", async () => {
  const opened: string[] = []; let checks = 0;
  const state = { desktop: { settings: { uiLocale: "en" }, distribution } };
  const context = { state, ports: { native: { openWindowsManagement: async (action: string) => { opened.push(action); } },
    checkUpdates: async () => { checks++; } } } as unknown as CommandContext;
  await runSystemCommands(context, "check-updates", ""); await runSystemCommands(context, "manage-startup", "");
  expect(opened).toEqual(["updates", "startup"]); expect(checks).toBe(0);
  delete (state.desktop as { distribution?: unknown }).distribution;
  await runSystemCommands(context, "check-updates", ""); expect(checks).toBe(1);
  await expect(runSystemCommands(context, "manage-startup", "")).rejects.toThrow();
});
