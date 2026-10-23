export type SpringProperty =
  | "scale"
  | "transform"
  | "translate"
  | "rotate"
  | "opacity"
  | "width"
  | "height"
  | "left"
  | "top"
  | "right"
  | "bottom";
export type SpringParameters = {
  stiffness: number;
  damping: number;
  mass: number;
  from: number;
  to: number;
  velocity?: number;
};
export type SpringSample = { value: number; velocity: number };
export type SpringOptions = Partial<SpringParameters> & {
  sampleRate?: number;
  restDelta?: number;
  restSpeed?: number;
  restCriterion?: "threshold" | "energy";
  maxDurationMs?: number;
  property?: SpringProperty;
  format?: (value: number) => string | number;
};
export type SpringFrame = { offset: number } & Partial<
  Record<SpringProperty, string | number>
>;
export type NativeAnimation = { finished: Promise<unknown>; cancel(): void };
export type SpringTarget = {
  style: Partial<Record<SpringProperty, string | number>>;
  ownerDocument?: { defaultView?: Pick<Window, "matchMedia"> | null };
  animate?: (
    frames: Keyframe[],
    options: KeyframeAnimationOptions,
  ) => NativeAnimation;
};
export type AnimationOptions = SpringOptions & {
  replaceKey?: string;
  signal?: AbortSignal;
  reducedMotion?: boolean | (() => boolean);
};
export type SpringStatus = "cancelled" | "finished" | "reduced";
export type SpringHandle = {
  finished: Promise<{ status: SpringStatus }>;
  cancel(): void;
  readonly animation: NativeAnimation | null;
  duration: number;
  settled: boolean;
};
