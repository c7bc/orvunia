import { createApiClient } from "./api.js";
import { createLegacyLive } from "../legacy-web/index.js";
import { createCompatibilityController } from "../legacy-web/workspace.js";
import { createCompatibilityData } from "../legacy-web/data.js";
import { createCompatibilityApplication } from "../legacy-web/application.js";
Object.assign(window, { CadenceApi: createApiClient() });
Object.assign(window, {
  CadenceWeb: {
    createLegacyLive,
    createCompatibilityController,
    createCompatibilityData,
    createCompatibilityApplication,
  },
});
