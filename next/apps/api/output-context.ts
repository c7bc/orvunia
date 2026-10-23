export function outputContext(set: {
  status?: unknown;
  headers: Record<string, string | number | readonly string[] | undefined>;
}) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(set.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else headers.set(name, String(value));
  }
  return { status: typeof set.status === "number" ? set.status : 200, headers };
}
