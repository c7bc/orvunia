export type PublicDeployment = {
  mode: "local" | "cloud";
  authEnabled: boolean;
  loginRequired: boolean;
  oauthGoogle: boolean;
  googleConfigured: boolean;
  smtpConfigured: boolean;
  emailDeliveryConfigured: boolean;
  requireEmailVerification: boolean;
  accountDeletionEnabled: boolean;
};
export function publicDeployment(
  mode: "local" | "cloud",
  google = false,
  deletion = false,
): PublicDeployment {
  const cloud = mode === "cloud";
  return {
    mode,
    authEnabled: cloud,
    loginRequired: cloud,
    oauthGoogle: cloud && google,
    googleConfigured: cloud && google,
    smtpConfigured: cloud,
    emailDeliveryConfigured: cloud,
    requireEmailVerification: cloud,
    accountDeletionEnabled: cloud && deletion,
  };
}
