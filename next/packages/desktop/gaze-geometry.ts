import type { GazePoint, WindowBounds } from "./gaze-types.ts";
export function gazeRequest(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !["enabled", "x", "y"].includes(key))
  )
    throw Error("Controle de olhar inválido.");
  const fields = value as Record<string, unknown>;
  const enabled = Object.hasOwn(fields, "enabled"),
    coordinates = Object.hasOwn(fields, "x") || Object.hasOwn(fields, "y");
  if (!enabled && !coordinates)
    throw Error("Informe a ativação ou as coordenadas do olhar.");
  if (enabled && typeof fields.enabled !== "boolean")
    throw Error("Ativação de olhar inválida.");
  if (
    coordinates &&
    (typeof fields.x !== "number" ||
      !Number.isFinite(fields.x) ||
      fields.x < 0 ||
      fields.x > 1 ||
      typeof fields.y !== "number" ||
      !Number.isFinite(fields.y) ||
      fields.y < 0 ||
      fields.y > 1 ||
      fields.enabled === false)
  )
    throw Error("Use coordenadas normalizadas de 0 a 1.");
  return {
    enabled: enabled ? (fields.enabled as boolean) : undefined,
    point: coordinates
      ? { x: fields.x as number, y: fields.y as number }
      : null,
  };
}
export function gazeTarget(
  bounds: WindowBounds,
  area: WindowBounds,
  point: GazePoint,
) {
  const px = area.x + point.x * area.width,
    py = area.y + point.y * area.height,
    gap = 36;
  let x = px + gap,
    y = py + gap;
  if (x + bounds.width > area.x + area.width) x = px - bounds.width - gap;
  if (y + bounds.height > area.y + area.height) y = py - bounds.height - gap;
  const top = area.y + Math.min(56, Math.max(0, area.height - bounds.height));
  return {
    x: Math.round(
      Math.max(
        area.x,
        Math.min(x, area.x + Math.max(0, area.width - bounds.width)),
      ),
    ),
    y: Math.round(
      Math.max(
        top,
        Math.min(y, area.y + Math.max(0, area.height - bounds.height)),
      ),
    ),
  };
}
export function smoothGaze(
  bounds: WindowBounds,
  area: WindowBounds,
  point: GazePoint,
) {
  const target = gazeTarget(bounds, area, point);
  return {
    x: Math.max(
      area.x,
      Math.min(
        Math.round(bounds.x + (target.x - bounds.x) * 0.3),
        area.x + Math.max(0, area.width - bounds.width),
      ),
    ),
    y: Math.max(
      area.y,
      Math.min(
        Math.round(bounds.y + (target.y - bounds.y) * 0.3),
        area.y + Math.max(0, area.height - bounds.height),
      ),
    ),
  };
}
