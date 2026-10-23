import type { SpringOptions, SpringSample, SpringFrame } from "./domain";
import { finite, springState } from "./physics";
const properties = new Set([
  "scale",
  "transform",
  "translate",
  "rotate",
  "opacity",
  "width",
  "height",
  "left",
  "top",
  "right",
  "bottom",
]);
export function springKeyframes(options: SpringOptions = {}) {
  const {
    stiffness = 520,
    damping = 28,
    mass = 0.7,
    from = 0,
    to = 1,
    velocity = 0,
    sampleRate = 120,
    restDelta = Math.abs(to - from) < 5 ? 0.005 : 0.5,
    restSpeed = Math.abs(to - from) < 5 ? 0.01 : 2,
    restCriterion = "threshold",
    maxDurationMs = 10000,
    property = "scale",
    format = (value: number) => value,
  } = options;
  const parameters = { stiffness, damping, mass, from, to, velocity };
  springState(parameters, 0);
  finite("sampleRate", sampleRate, { min: 1, max: 240 });
  finite("restDelta", restDelta, { min: 0, exclusive: true });
  finite("restSpeed", restSpeed, { min: 0, exclusive: true });
  finite("maxDurationMs", maxDurationMs, {
    min: 0,
    max: 60000,
    exclusive: true,
  });
  if (!properties.has(property))
    throw new TypeError("Unsupported spring CSS property");
  if (typeof format !== "function")
    throw new TypeError("Spring format must be a function");
  if (!["threshold", "energy"].includes(restCriterion))
    throw new TypeError("Unknown spring rest criterion");
  const samples: (SpringSample & { timeMs: number })[] = [],
    omega2 = stiffness / mass;
  const atRest = (sample: SpringSample) => {
    const y = sample.value - to;
    if (restCriterion === "threshold")
      return Math.abs(y) <= restDelta && Math.abs(sample.velocity) <= restSpeed;
    return (
      Math.hypot(y, sample.velocity / Math.sqrt(omega2)) <= restDelta &&
      Math.hypot(Math.sqrt(omega2) * y, sample.velocity) <= restSpeed
    );
  };
  const count = Math.ceil((maxDurationMs * sampleRate) / 1000);
  let settled = false;
  for (let index = 0; index <= count; index++) {
    const timeMs = Math.min((index * 1000) / sampleRate, maxDurationMs),
      sample = { timeMs, ...springState(parameters, timeMs) };
    samples.push(sample);
    if (atRest(sample)) {
      settled = true;
      break;
    }
    if (timeMs === maxDurationMs) break;
  }
  const duration = samples.at(-1)?.timeMs ?? 0;
  const frame = (value: number, offset: number): SpringFrame => {
    const formatted = format(value);
    if (
      (typeof formatted !== "string" && typeof formatted !== "number") ||
      (typeof formatted === "number" && !Number.isFinite(formatted))
    )
      throw new TypeError(
        "Spring format must return a finite number or CSS string",
      );
    return { offset, [property]: formatted };
  };
  const keyframes =
    duration === 0
      ? [frame(from, 0), frame(to, 1)]
      : samples.map((sample, index) =>
          frame(
            settled && index === samples.length - 1 ? to : sample.value,
            sample.timeMs / duration,
          ),
        );
  return {
    keyframes,
    duration,
    samples,
    settled,
    property,
    parameters,
    rest: { delta: restDelta, speed: restSpeed, criterion: restCriterion },
    timing: { duration, easing: "linear", fill: "both" as const },
  };
}
