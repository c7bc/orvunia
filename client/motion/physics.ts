import type { SpringParameters } from "./domain";
export function finite(
  name: string,
  value: unknown,
  {
    min = -Infinity,
    max = Infinity,
    exclusive = false,
  }: { min?: number; max?: number; exclusive?: boolean } = {},
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (exclusive ? value <= min : value < min) ||
    value > max
  )
    throw new TypeError(`Invalid spring ${name}`);
  return value;
}

/** Returns exact displacement and velocity (units/second) for a damped spring. */
export function springState(
  { stiffness, damping, mass, from, to, velocity = 0 }: SpringParameters,
  timeMs: number,
) {
  finite("stiffness", stiffness, { min: 0, exclusive: true });
  finite("damping", damping, { min: 0 });
  finite("mass", mass, { min: 0, exclusive: true });
  finite("from", from);
  finite("to", to);
  finite("velocity", velocity);
  finite("timeMs", timeMs, { min: 0 });
  const t = timeMs / 1000,
    alpha = damping / (2 * mass),
    omega2 = stiffness / mass,
    discriminant = alpha * alpha - omega2,
    displacement = from - to;
  let x, v;
  if (Math.abs(discriminant) <= 1e-10 * Math.max(omega2, alpha * alpha)) {
    const b = velocity + alpha * displacement,
      decay = Math.exp(-alpha * t);
    x = decay * (displacement + b * t);
    v = decay * (velocity - alpha * b * t);
  } else if (discriminant < 0) {
    const omega = Math.sqrt(-discriminant),
      b = (velocity + alpha * displacement) / omega,
      decay = Math.exp(-alpha * t),
      c = Math.cos(omega * t),
      s = Math.sin(omega * t);
    x = decay * (displacement * c + b * s);
    v =
      decay *
      ((-alpha * displacement + b * omega) * c +
        (-alpha * b - displacement * omega) * s);
  } else {
    const root = Math.sqrt(discriminant),
      slow = -omega2 / (alpha + root),
      fast = -alpha - root,
      a = (velocity - fast * displacement) / (slow - fast),
      b = displacement - a,
      slowDecay = Math.exp(slow * t),
      fastDecay = Math.exp(fast * t);
    x = a * slowDecay + b * fastDecay;
    v = slow * a * slowDecay + fast * b * fastDecay;
  }
  return { value: to + x, velocity: v };
}
