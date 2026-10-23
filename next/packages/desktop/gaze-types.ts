export type GazePoint = { x: number; y: number };
export type WindowBounds = GazePoint & { width: number; height: number };
export type GazeWindow = {
  isDestroyed(): boolean;
  getBounds(): WindowBounds;
  setPosition(x: number, y: number): void;
};
export type GazePorts = {
  window(): GazeWindow | null | undefined;
  area(bounds: WindowBounds): WindowBounds;
  clamp(bounds: WindowBounds): WindowBounds;
  clock(): number;
  align(): void;
  restored(): void;
  changed(): void;
};
export type GazeTracking = {
  enabled: boolean;
  previous: WindowBounds | null;
  lastMove: number | null;
  sender: number | null;
};
