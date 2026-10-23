import panel from "./panel";
import assistant from "./assistant";
import coding from "./coding";
import onboarding from "./personal-onboarding";
import google from "./messages/google";
export const catalog = { ...panel, ...assistant, ...coding, ...onboarding, ...google };
