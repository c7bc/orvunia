import type { Features, GazeSample, GazeModel } from "./contracts";
export function design(features: Features) {
  const [leftX, leftY, rightX, rightY] = features,
    x = (leftX + rightX) / 2,
    y = (leftY + rightY) / 2;
  return [...features, x * x, y * y, x * y];
}
function solve(matrix: number[][], vector: number[]) {
  const count = vector.length,
    augmented = matrix.map((row, index) => [...row, vector[index]!]);
  for (let column = 0; column < count; column++) {
    let pivot = column;
    for (let row = column + 1; row < count; row++)
      if (
        Math.abs(augmented[row]![column]!) >
        Math.abs(augmented[pivot]![column]!)
      )
        pivot = row;
    if (Math.abs(augmented[pivot]![column]!) < 1e-12)
      throw Error("A calibração não tem variação suficiente.");
    [augmented[column], augmented[pivot]] = [
      augmented[pivot]!,
      augmented[column]!,
    ];
    const current = augmented[column]!,
      divisor = current[column]!;
    for (let index = column; index <= count; index++)
      current[index] = current[index]! / divisor;
    for (let row = 0; row < count; row++)
      if (row !== column) {
        const other = augmented[row]!,
          factor = other[column]!;
        for (let index = column; index <= count; index++)
          other[index] = other[index]! - factor * current[index]!;
      }
  }
  return augmented.map((row) => row[count]!);
}
export function train(samples: GazeSample[], ridge = 1): GazeModel {
  const rows = samples.map((sample) => design(sample.features)),
    columns = rows[0]!.length;
  const means = Array.from(
    { length: columns },
    (_, index) => rows.reduce((sum, row) => sum + row[index]!, 0) / rows.length,
  );
  const scales = means.map((mean, index) =>
    Math.max(
      index >= 10 ? 0.0002 : index < 4 ? 0.002 : 0.005,
      Math.sqrt(
        rows.reduce((sum, row) => sum + (row[index]! - mean) ** 2, 0) /
          rows.length,
      ),
    ),
  );
  const normalized = rows.map((row) => [
      1,
      ...row.map((value, index) => (value - means[index]!) / scales[index]!),
    ]),
    count = columns + 1;
  const matrix = Array.from({ length: count }, () =>
      Array<number>(count).fill(0),
    ),
    targetX = Array<number>(count).fill(0),
    targetY = Array<number>(count).fill(0);
  normalized.forEach((row, index) => {
    for (let first = 0; first < count; first++) {
      targetX[first] = targetX[first]! + row[first]! * samples[index]!.target.x;
      targetY[first] = targetY[first]! + row[first]! * samples[index]!.target.y;
      for (let second = 0; second < count; second++)
        matrix[first]![second] =
          matrix[first]![second]! + row[first]! * row[second]!;
    }
  });
  for (let index = 0; index < count; index++)
    matrix[index]![index] =
      matrix[index]![index]! + (index === 0 ? 1e-8 : ridge);
  return {
    means,
    scales,
    x: solve(matrix, targetX),
    y: solve(matrix, targetY),
  };
}
