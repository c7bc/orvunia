export function readCommandForm(form: HTMLFormElement): Record<string, string> {
  const values: [string,string][] = [];
  for (const [key, value] of new FormData(form)) {
    if (typeof value !== "string")
      throw Error("Este formulário aceita somente campos de texto.");
    values.push([key,value]);
  }
  return Object.fromEntries(values);
}
