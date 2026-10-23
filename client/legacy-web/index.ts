import type { BrowserContext, LiveController } from "./contracts.js";
import { createBootstrapMethods } from "./bootstrap.js";
import { createGenerationMethods } from "./generation.js";
import { createSessionsMethods } from "./sessions.js";
import { createViewsMethods } from "./views.js";
import { createSessionViewMethods } from "./session-view.js";
import { createAudioMethods } from "./audio.js";
import { createCapturesMethods } from "./captures.js";
import { createFormsMethods } from "./forms.js";
import { createMutationsMethods } from "./mutations.js";
import { createBindingMethods } from "./binding.js";
export function createLegacyLive(context: BrowserContext): LiveController {
  return {
    sessionId: null,
    creating: null,
    health: null,
    answers: { recruiter: null, technical: null },
    controller: null,
    audio: context.ports.audio,
    recording: false,
    practiceSelected: false,
    pendingChunks: 0,
    ...createBootstrapMethods(context),
    ...createGenerationMethods(context),
    ...createSessionsMethods(context),
    ...createViewsMethods(context),
    ...createSessionViewMethods(context),
    ...createAudioMethods(context),
    ...createCapturesMethods(context),
    ...createFormsMethods(context),
    ...createMutationsMethods(context),
    ...createBindingMethods(context),
  };
}
