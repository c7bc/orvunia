export function definedFields<Value extends object>(value: Value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as { [Key in keyof Value]: Exclude<Value[Key], undefined> };
}
