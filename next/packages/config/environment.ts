export function configurationEnvironment(
  environment: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined && entry[1] !== "",
    ),
  );
}
