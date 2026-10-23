export const foldSearch = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
