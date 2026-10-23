import type { FollowupPlatform } from "./contracts";
export function browserFollowups(): FollowupPlatform {
  return {
    document,
    storage: localStorage,
    values: (form) => {
      const result: Record<string, string> = {};
      for (const [key, value] of new FormData(form))
        if (typeof value === "string") result[key] = value;
      return result;
    },
    copy: (text) => navigator.clipboard.writeText(text),
    schedule(callback, milliseconds) {
      const timer = setTimeout(callback, milliseconds);
      return () => clearTimeout(timer);
    },
  };
}
