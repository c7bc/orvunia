import { systemAudioRequest, unsupportedCatalog } from "./contracts.ts";
import type { SystemAudioPorts } from "./ports.ts";
import { SystemAudioError } from "./ports.ts";
import { createSystemAudioCapture } from "./capture.ts";

export function createSystemAudioManager(ports: SystemAudioPorts) {
  type Capture = ReturnType<typeof createSystemAudioCapture>;
  let active: Capture | null = null;
  const receipts = new Map<string, { senderId: number; frames: number }>();
  return {
    async invoke(senderId: number, value: unknown) {
      const input = systemAudioRequest.parse(value);
      if (input.action === "list") return ports.supported() ? ports.enumerate() : unsupportedCatalog();
      if (!ports.supported()) throw new SystemAudioError("system_audio_unsupported");
      if (input.action === "start") {
        if (active) throw new SystemAudioError("system_audio_busy");
        if (receipts.has(input.captureId)) throw new SystemAudioError("system_audio_request_conflict");
        const owner = { senderId, sessionId: input.sessionId };
        if (!ports.allowed(owner)) throw new SystemAudioError("system_audio_owner_changed");
        const capture = createSystemAudioCapture(ports, owner, input.captureId, input.endpointId, () => {
          receipts.set(capture.captureId, { senderId, frames: capture.frames() });
          if (receipts.size > 8) receipts.delete(receipts.keys().next().value!);
          if (active === capture) active = null;
        });
        active = capture;
        return { ...await capture.start(), captureId: capture.captureId };
      }
      const capture = active;
      if (!capture || capture.captureId !== input.captureId || capture.owner.senderId !== senderId) {
        const receipt = receipts.get(input.captureId);
        if (receipt?.senderId === senderId) return input.action === "ack" ? { acknowledged: true }
          : input.action === "stop" ? { stopped: true, frames: receipt.frames } : { frames: receipt.frames };
        throw new SystemAudioError("system_audio_capture_not_found");
      }
      if (input.action === "stop") { await capture.stop(); return { stopped: true, frames: capture.frames() }; }
      if (!ports.allowed(capture.owner)) { await capture.stop().catch(() => {}); throw new SystemAudioError("system_audio_owner_changed"); }
      if (input.action === "ack") { capture.acknowledge(input.sequence); return { acknowledged: true }; }
      return capture.flush(input.id);
    },
    async stop() { await active?.stop(); },
    async senderGone(senderId: number) { if (active?.owner.senderId === senderId) await active.stop(); },
  };
}
