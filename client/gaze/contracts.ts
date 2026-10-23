export type Point = { x: number; y: number };
export type Features = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export type GazeSignal = { features: Features; quality: number };
export type GazeSample = { features: Features; target: Point };
export type GazeModel = {
  means: number[];
  scales: number[];
  x: number[];
  y: number[];
};
