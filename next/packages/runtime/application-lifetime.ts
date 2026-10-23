import { cleanupScope } from "./cleanup.ts";

type Release = () => void | Promise<void>;

export function applicationLifetime() {
  const resources = cleanupScope();
  const activities: Release[] = [];
  let draining: Promise<void> | null = null;
  let closing: Promise<void> | null = null;

  function assertOpen() {
    if (draining || closing) throw Error("Application lifetime is closing");
  }

  function drain() {
    if (draining) return draining;
    draining = (async () => {
      const outcomes = await Promise.allSettled(
        activities.map((release) => Promise.resolve().then(release)),
      );
      const failures = outcomes.flatMap((outcome) =>
        outcome.status === "rejected" ? [outcome.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(failures, "Application drain failed");
    })();
    return draining;
  }

  function close() {
    if (closing) return closing;
    closing = (async () => {
      const failures: unknown[] = [];
      try {
        await drain();
      } catch (error) {
        failures.push(error);
      }
      try {
        await resources.close();
      } catch (error) {
        failures.push(error);
      }
      if (failures.length)
        throw new AggregateError(failures, "Application cleanup failed");
    })();
    return closing;
  }

  return {
    resource(release: Release) {
      assertOpen();
      resources.defer(release);
    },
    activity(release: Release) {
      assertOpen();
      activities.push(release);
    },
    drain,
    close,
  };
}
