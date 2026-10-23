import { expect, test } from "bun:test";
import { createNativeReminders } from "../../packages/desktop/native-reminders.ts";
import { createNativeCapture } from "../../packages/desktop/native-capture.ts";
import { createNativeExport } from "../../packages/desktop/native-export.ts";
import type { NativeCaptureSource } from "../../packages/desktop/native-capture.ts";

test("reminder replacement validates before cancelling, fences queued callbacks and suppresses notifications after shutdown", () => {
  const callbacks = new Map<number, () => void>(),
    shown: string[] = [],
    cancelled: number[] = [];
  let enabled = true,
    next = 0;
  const clock = new Date("2026-10-15T12:00:00Z").getTime();
  const reminders = createNativeReminders({
    enabled: () => enabled,
    clock: () => clock,
    locale: () => "en",
    schedule(callback, delay) {
      expect(delay).toBe(60000);
      callbacks.set(++next, callback);
      return next;
    },
    cancel: (timer: number) => {
      cancelled.push(timer);
    },
    show: (title, body) => shown.push(`${title}:${body}`),
  });
  const items = [
    {
      title: "Synthetic meeting",
      date: new Date(clock + 6 * 60000).toISOString(),
    },
  ];
  expect(reminders.replace(items)).toEqual({ scheduled: 1 });
  expect(() => reminders.replace([null])).toThrow("Agenda");
  expect(cancelled).toEqual([]);
  reminders.replace(items);
  callbacks.get(1)!();
  expect(shown).toEqual([]);
  callbacks.get(2)!();
  expect(shown).toEqual([
    "Your conversation starts in 5 minutes:Synthetic meeting",
  ]);
  expect(reminders.pending()).toBe(0);
  reminders.replace(items);
  enabled = false;
  callbacks.get(3)!();
  expect(shown).toHaveLength(1);
  expect(reminders.replace("bad input in background")).toEqual({
    scheduled: 0,
  });
  reminders.stop();
});

test("capture selection freezes requested source and prevents old completions or shutdown from installing another source", async () => {
  const waiting: ((value: NativeCaptureSource[]) => void)[] = [],
    options: unknown[] = [];
  let selected: string | null = null,
    blocked = false;
  const source = (id: string): NativeCaptureSource => ({
    id,
    name: id,
    display_id: "1",
    thumbnail: { toDataURL: () => "synthetic:" + id },
  });
  const captures = createNativeCapture({
    interactive() {
      if (blocked) throw Error("shutdown");
    },
    sources(value) {
      options.push(value);
      return new Promise((resolve) => waiting.push(resolve));
    },
    selected: () => selected,
    select: (id) => {
      selected = id;
    },
    clipboard: () => "x".repeat(40000),
  });
  const first = captures.select("first"),
    second = captures.select("second");
  waiting[1]!([source("second")]);
  await second;
  waiting[0]!([source("first")]);
  await expect(first).rejects.toThrow("alterada");
  expect(selected as string | null).toBe("second");
  const capture = captures.capture();
  expect(options[2]).toMatchObject({
    thumbnailSize: { width: 1920, height: 1080 },
  });
  blocked = true;
  waiting[2]!([source("second")]);
  await expect(capture).rejects.toThrow("shutdown");
  blocked = false;
  expect(captures.clipboard()).toHaveLength(30000);
  const list = captures.list();
  waiting[3]!([
    source("Cadence — Panel"),
    source("Orvunia — Assistente"),
    source("external"),
  ]);
  expect(await list).toMatchObject([{ id: "external" }]);
});

test("native markdown export freezes content before file dialog, refuses concurrent prompts and performs no write after abort", async () => {
  let choose:
    ((value: { canceled: boolean; filePath?: string }) => void) | null = null;
  const writes: string[] = [],
    defaults: string[] = [],
    controller = new AbortController();
  const exportFile = createNativeExport({
    interactive() {},
    signal: controller.signal,
    choose(options) {
      defaults.push(options.defaultPath);
      return new Promise((resolve) => {
        choose = resolve;
      });
    },
    async write(filename, text) {
      writes.push(filename + ":" + text);
    },
  });
  const value = { name: "../Synthetic", text: "original" },
    first = exportFile(value);
  value.text = "changed";
  expect(() => exportFile({ text: "another" })).toThrow("andamento");
  choose!({ canceled: false, filePath: "/synthetic/export.md" });
  expect(await first).toEqual({ saved: true });
  expect(writes).toEqual(["/synthetic/export.md:original"]);
  expect(defaults).toEqual(["..Synthetic.md"]);
  const aborted = exportFile({ text: "cancelled" });
  controller.abort();
  choose!({ canceled: false, filePath: "/synthetic/abort.md" });
  await expect(aborted).rejects.toHaveProperty("name", "AbortError");
  expect(writes).toHaveLength(1);
});
