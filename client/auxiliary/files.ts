import type { AuxiliaryTransport } from "./contracts.js";

export async function chooseAuxiliaryFiles(transport: AuxiliaryTransport, accept: string, multiple: boolean) {
  const response = await transport.invoke({ action: "files", accept, multiple });
  if (!Array.isArray(response) || response.length > (multiple ? 20 : 1)) throw Error("auxiliary_file_limit");
  let total = 0;
  return response.map((item: unknown) => {
    if (!item || typeof item !== "object") throw Error("auxiliary_file_invalid");
    const value = item as Record<string, unknown>;
    if (typeof value.name !== "string" || /[/\\]/.test(value.name) || value.name.length > 255
      || typeof value.type !== "string" || value.type.length > 100 || typeof value.data !== "string"
      || value.data.length > 34 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.data)) throw Error("auxiliary_file_invalid");
    const decoded = atob(value.data); total += decoded.length;
    if (decoded.length > 24 * 1024 * 1024 || total > 32 * 1024 * 1024) throw Error("auxiliary_file_limit");
    return new File([Uint8Array.from(decoded, character => character.charCodeAt(0))], value.name, { type: value.type });
  });
}
