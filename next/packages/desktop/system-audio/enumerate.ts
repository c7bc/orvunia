import { endpointCatalog } from "./contracts.ts";
import type { LaunchHelper } from "./ports.ts";
import { SystemAudioError } from "./ports.ts";

export async function enumerateSystemAudio(launch: LaunchHelper) {
  const chunks: Uint8Array[] = [];
  let bytes = 0, failure: Error | null = null;
  const process = launch("enumerate", {
    data(value) {
      bytes += value.byteLength;
      if (bytes > 1024 * 1024) { failure = new SystemAudioError("system_audio_protocol"); process.terminate(); }
      else chunks.push(value);
    },
    metadata() { failure = new SystemAudioError("system_audio_enumeration_failed"); },
    exited() {},
  });
  const timeout = setTimeout(() => { failure = new SystemAudioError("system_audio_timeout"); process.terminate(); }, 15000);
  timeout.unref();
  try {
    const code = await process.closed;
    if (failure) throw failure;
    if (code !== 0) throw new SystemAudioError("system_audio_enumeration_failed");
    const data = Buffer.concat(chunks);
    return endpointCatalog.parse(JSON.parse(data.toString("utf8").replace(/^\uFEFF/, "")));
  } finally { clearTimeout(timeout); }
}
