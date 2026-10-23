export function lifecycleScope(workspace: () => string) {
  let version = 0,
    selection = 0,
    disposed = false;
  let loading: AbortController | null = null;
  const controllers = new Set<AbortController>();
  function request(select = false) {
    if (disposed) throw new DOMException("Interrupted", "AbortError");
    if (select) {
      selection++;
      loading?.abort();
    }
    const controller = new AbortController(),
      epoch = version,
      selected = selection,
      owner = workspace();
    if (select) loading = controller;
    controllers.add(controller);
    const owned = () =>
      !disposed &&
      !controller.signal.aborted &&
      epoch === version &&
      owner === workspace();
    return {
      signal: controller.signal,
      owned,
      selected: () => owned() && selected === selection,
      assert() {
        if (!owned()) throw new DOMException("Interrupted", "AbortError");
      },
      release() {
        controllers.delete(controller);
        if (loading === controller) loading = null;
      },
    };
  }
  function reset() {
    version++;
    selection++;
    for (const controller of controllers) controller.abort();
    controllers.clear();
    loading = null;
  }
  return {
    request,
    reset,
    dispose() {
      disposed = true;
      reset();
    },
  };
}
export type LifecycleScope = ReturnType<typeof lifecycleScope>;
