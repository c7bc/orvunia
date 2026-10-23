import type { Features, GazeModel, GazeSample } from "./contracts";
import { design, train } from "./training";
export function predictGaze(
  model: GazeModel | null | undefined,
  features: number[] | null | undefined,
) {
  if (
    !model ||
    features?.length !== 10 ||
    features.some((value) => !Number.isFinite(value))
  )
    return null;
  const row = [
    1,
    ...design(features as Features).map(
      (value, index) => (value - model.means[index]!) / model.scales[index]!,
    ),
  ];
  const result = {
    x: row.reduce((sum, value, index) => sum + value * model.x[index]!, 0),
    y: row.reduce((sum, value, index) => sum + value * model.y[index]!, 0),
  };
  return Number.isFinite(result.x) && Number.isFinite(result.y) ? result : null;
}
export function fitGazeCalibration(samples: GazeSample[]) {
  if (
    !Array.isArray(samples) ||
    samples.length < 90 ||
    samples.some(
      (sample) =>
        sample.features?.length !== 10 ||
        sample.features.some((value) => !Number.isFinite(value)) ||
        !Number.isFinite(sample.target?.x) ||
        !Number.isFinite(sample.target?.y),
    )
  )
    throw Error("Colete nove pontos com os olhos visíveis antes de concluir.");
  const targets = new Set(
    samples.map(
      (sample) => `${sample.target.x.toFixed(3)}:${sample.target.y.toFixed(3)}`,
    ),
  );
  if (targets.size < 9) throw Error("A calibração precisa dos nove pontos.");
  const irisX = samples.map(
      (sample) => (sample.features[0] + sample.features[2]) / 2,
    ),
    irisY = samples.map(
      (sample) => (sample.features[1] + sample.features[3]) / 2,
    );
  if (
    Math.max(...irisX) - Math.min(...irisX) < 0.012 ||
    Math.max(...irisY) - Math.min(...irisY) < 0.008
  )
    throw Error(
      "Não houve movimento suficiente das íris. Recalibre olhando para cada ponto sem mover a cabeça.",
    );
  const training = samples.filter((_, index) => index % 4 !== 0),
    validation = samples.filter((_, index) => index % 4 === 0),
    validationModel = train(training);
  const imprecise =
    "A calibração ficou imprecisa. Ajuste a luz, mantenha a cabeça parada e tente novamente.";
  const rmse = Math.sqrt(
    validation.reduce((sum, sample) => {
      const prediction = predictGaze(validationModel, sample.features);
      if (!prediction) throw Error(imprecise);
      return (
        sum +
        (prediction.x - sample.target.x) ** 2 +
        (prediction.y - sample.target.y) ** 2
      );
    }, 0) / validation.length,
  );
  if (!Number.isFinite(rmse) || rmse > 0.2) throw Error(imprecise);
  return { model: train(samples), rmse, samples: samples.length };
}
