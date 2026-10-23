import { migrationFiles } from "./migrations.ts";

export async function schemaReadiness(dialect: "sqlite") {
  const expected = await migrationFiles(dialect);
  return migrationReadiness(expected);
}
export function migrationReadiness(expected: { name: string; hash: string }[]) {
  return (applied: { name: string; hash: string }[]) => {
    const found = new Map(applied.map((entry) => [entry.name, entry.hash]));
    return (
      expected.length > 0 &&
      expected.every((entry) => found.get(entry.name) === entry.hash)
    );
  };
}
