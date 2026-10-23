export type GazeBrowser = ReturnType<typeof gazeBrowser>;
export function gazeBrowser() {
  return {
    window,
    document,
    screen: screen as Screen & Partial<{ availLeft: number; availTop: number }>,
    now: () => performance.now(),
    later: (action: () => void, milliseconds: number) =>
      setTimeout(action, milliseconds),
    cancel: (timer: number | null | undefined) => {
      if (timer !== null && timer !== undefined) clearTimeout(timer);
    },
    supported: () =>
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      Boolean(window.Worker) &&
      Boolean(window.createImageBitmap),
    activeGesture: () =>
      !navigator.userActivation || navigator.userActivation.isActive,
    media: () =>
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 640, max: 640 },
          height: { ideal: 480, max: 480 },
          frameRate: { ideal: 15, max: 20 },
          facingMode: "user",
        },
      }),
    worker: () =>
      new Worker(new URL("./assets/gaze/gaze-worker.js", import.meta.url)),
    bitmap: (video: HTMLVideoElement) => createImageBitmap(video),
  };
}
