export function capturedSignal(values: Float32Array, system: boolean) {
  const energy = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
  return { active: system ? values.some(value => Number.isFinite(value) && Math.abs(value) >= 1 / 32768) : energy > 0.004,
    energy };
}
