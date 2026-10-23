export type TimerHandle = number | ReturnType<typeof setTimeout>;
export type TimerOptions = {
  schedule?: (callback: () => void, milliseconds: number) => TimerHandle;
  cancel?: (handle: TimerHandle) => void;
};
