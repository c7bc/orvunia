import type { ConnectionProbe } from "../connections/routes.ts";
import type { HttpFetch } from "./http.ts";
import { generation } from "./generation.ts";
import { transcription } from "./audio.ts";
import { enumerateModels } from "./enumerate.ts";
import { definedFields } from "../contracts/defined.ts";
import { responseConnection, transcriptionConnection } from "../contracts/providers.ts";

const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8mQAAAAASUVORK5CYII=", "base64");
function silentWave() {
  const data = Buffer.alloc(32044);
  data.write("RIFF", 0); data.writeUInt32LE(data.length - 8, 4); data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(16000, 24); data.writeUInt32LE(32000, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write("data", 36); data.writeUInt32LE(32000, 40);
  return data;
}
export function connectionProbe(transport: HttpFetch): ConnectionProbe {
  return {
    async test(connection, signal) {
      if (connection.capabilities.includes("text") || connection.capabilities.includes("vision")) {
        const visual = connection.capabilities.includes("vision");
        await generation(definedFields(responseConnection.parse({ ...connectionFields(connection),
          vision: visual, maxTokens: 128 })), transport).answer({
          instructions: "Connection test. Reply briefly.", context: visual ? "Describe the image." : "Reply OK.",
          images: visual ? [{ mime: "image/png", data: pixel }] : [],
        }, signal, () => {});
      }
      if (connection.capabilities.includes("transcription"))
        await transcription(definedFields(transcriptionConnection.parse(connectionFields(connection))), transport).transcribe({
          data: silentWave(), mime: "audio/wav", name: "connection-test.wav", language: "auto", prompt: "",
        }, signal);
      return { ready: true, capabilities: connection.capabilities };
    },
    async models(connection, signal) {
      if (["deepgram", "assemblyai"].includes(connection.provider)) return [];
      const result = await enumerateModels(connection, transport, signal);
      return result.models.map(id => ({ id, capabilities: [] }));
    },
  };
}
function connectionFields(connection: Parameters<ConnectionProbe["test"]>[0]) {
  return { provider: connection.provider, baseUrl: connection.baseUrl,
    model: connection.model, apiKey: connection.apiKey };
}
