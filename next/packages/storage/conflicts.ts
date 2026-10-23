export function uniqueViolation(error: unknown) {
  let current = error;
  for (
    let depth = 0;
    depth < 5 && current && typeof current === "object";
    depth++
  ) {
    if (
      "code" in current &&
      [
        "23505",
        "SQLITE_CONSTRAINT_UNIQUE",
        "SQLITE_CONSTRAINT_PRIMARYKEY",
      ].includes(String(current.code))
    )
      return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}
