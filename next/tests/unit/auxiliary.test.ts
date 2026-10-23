import { expect, test } from "bun:test";
import { auxiliaryBounds } from "../../packages/desktop/auxiliary-geometry.ts";
import { auxiliaryAction } from "../../packages/desktop/auxiliary-contracts.ts";

test("auxiliary surfaces choose the available side without changing conversation geometry", () => {
  const area = { x: 0, y: 0, width: 1920, height: 1080 };
  const anchor = { x: 100, y: 100, width: 540, height: 140 }, original = { ...anchor };
  expect(auxiliaryBounds(anchor, area, 480, 400)).toEqual({ x: 652, y: 100, width: 480, height: 400 });
  expect(auxiliaryBounds({ ...anchor, x: 1300 }, area, 480, 400).x).toBe(808);
  expect(anchor).toEqual(original);
  expect(auxiliaryBounds(anchor, { x: 0, y: 0, width: 390, height: 300 }, 480, 900))
    .toEqual({ x: 0, y: 0, width: 390, height: 300 });
  expect(auxiliaryBounds({ ...anchor, x: -600, y: -20 }, { x: -1920, y: -100, width: 1920, height: 1080 }, 480, 400).x)
    .toBe(-1092);
});

test("auxiliary messages reject arbitrary actions, unbounded content and malformed interactions", () => {
  const documentId = crypto.randomUUID();
  expect(auxiliaryAction.safeParse({ action: "publish", documentId, revision: 1, html: "x".repeat(262145),
    kind: "modal", theme: "dark", locale: "pt-BR" }).success).toBeFalse();
  expect(auxiliaryAction.safeParse({ action: "execute", script: "unsafe" }).success).toBeFalse();
  expect(auxiliaryAction.safeParse({ action: "interact", documentId, revision: 1, type: "click", target: "1", script: "unsafe" }).success).toBeFalse();
  expect(auxiliaryAction.safeParse({ action: "interact", documentId, revision: 1, type: "click", target: "1" }).success).toBeTrue();
  expect(auxiliaryAction.safeParse({ action: "resize", height: 1601 }).success).toBeFalse();
});
