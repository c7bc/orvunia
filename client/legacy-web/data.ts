import { icons } from "./icons.js";
import { initialTranscripts } from "./initial-transcripts.js";
import { extraTranscripts } from "./extra-transcripts.js";
import { problems } from "./practice-data.js";
import type { WorkspaceData } from "./workspace-types.js";
export function createCompatibilityData(): WorkspaceData {
  return structuredClone({
    icons,
    initialTranscripts,
    extraTranscripts,
    problems,
  });
}
