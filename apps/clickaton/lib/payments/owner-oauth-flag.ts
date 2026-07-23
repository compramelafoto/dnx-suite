import {
  canStartLiveOwnerOAuth,
  isOwnerOnboardingEnabled,
  OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE,
  readClickatonMpOAuthAppConfig,
} from "@repo/payments";

export {
  canStartLiveOwnerOAuth,
  isOwnerOnboardingEnabled,
  OWNER_OAUTH_MANUAL_AUTHORIZATION_PHRASE,
  readClickatonMpOAuthAppConfig,
};

export function assertOwnerOnboardingFlagEnabled(): void {
  if (!isOwnerOnboardingEnabled()) {
    throw new Error("DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED is OFF");
  }
}
