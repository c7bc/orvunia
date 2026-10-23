import { expect, test } from "bun:test";
import { ChunkRecorder } from "../../../client/audio/recorder.ts";
import type { AudioPlatform } from "../../../client/audio/contracts.ts";
test("stopping chunk capture while microphone permission is pending releases a late stream without recording", async () => {
  let resolveStream!: (stream: MediaStream) => void;
  let stopped = 0,
    contexts = 0,
    microphones = 0;
  const microphone = new Promise<MediaStream>((resolve) => {
    resolveStream = resolve;
  });
  const platform: AudioPlatform = {
    available: () => true,
    displayAvailable: () => true,
    display: () => microphone,
    microphone: () => {
      microphones++;
      return microphone;
    },
    stream: () => {
      throw Error("A cancelled stream must not be connected");
    },
    format: () => "audio/webm",
    recorder: () => {
      throw Error("No recording allowed");
    },
    context: () => {
      contexts++;
      throw Error("No audio graph allowed");
    },
    clock: () => 0,
  };
  const audio = new ChunkRecorder(platform);
  const statuses: string[] = [];
  const pending = audio
    .start(
      "microphone",
      () => {},
      (state) => statuses.push(state),
    )
    .catch((error: unknown) => error);
  await audio.start(
    "microphone",
    () => {},
    () => {},
  );
  expect(microphones).toBe(1);
  await audio.stop();
  resolveStream({
    getTracks: () => [
      {
        stop() {
          stopped++;
        },
      },
    ],
  } as unknown as MediaStream);
  const error = await pending;
  expect(error).toBeInstanceOf(DOMException);
  expect((error as DOMException).name).toBe("AbortError");
  expect(stopped).toBe(1);
  expect(contexts).toBe(0);
  expect(statuses).not.toContain("recording");
  expect(audio.running).toBe(false);
  expect(audio.starting).toBe(false);
});
