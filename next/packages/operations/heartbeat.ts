export function heartbeat(
  check: () => Promise<boolean>,
  abort: () => void,
  milliseconds: number,
) {
  let pending: Promise<void> | null = null,
    stopped = false;
  const timer = setInterval(() => {
    if (pending || stopped) return;
    pending = (async () => {
      try {
        if (!(await check())) abort();
      } catch {
        abort();
      }
    })().finally(() => {
      pending = null;
    });
  }, milliseconds);
  timer.unref();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await pending;
  };
}
